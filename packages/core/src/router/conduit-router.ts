import { createUuidV7 } from "../envelope/envelope-builder.js";
import { isEnvelopeExpired, validateEnvelope } from "../envelope/envelope-validator.js";
import type { DLQAttemptRecord } from "../dlq/dlq-entry.js";
import type { IDLQManager } from "../dlq/dlq-manager.js";
import { MiddlewarePipeline, type DispatchMiddleware } from "../middleware/middleware-pipeline.js";
import {
  RetryExecutor,
  toRetryPolicyFromConfig
} from "../retry/index.js";
import {
  BackpressureError,
  ConfigurationError,
  DeliveryExhaustedError,
  ValidationError
} from "../types/errors.js";
import type { OperationEnvelope } from "../types/envelope.js";
import type { RegisteredHandler } from "../types/handler.js";
import type { ITransportProvider } from "../types/provider.js";
import type { DispatchResult, HandlerDispatchResult } from "../types/result.js";
import type { RetryConfig, RouteConfig } from "../types/route.js";
import { HandlerRegistry } from "./handler-registry.js";
import { RouteRegistry } from "./route-registry.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

interface RouterDependencies {
  route_registry: RouteRegistry;
  handler_registry: HandlerRegistry;
  providers: Map<string, ITransportProvider>;
  dlq_manager: IDLQManager | undefined;
  middlewares: DispatchMiddleware[];
  retry_executor: RetryExecutor | undefined;
}

const defaultRetryConfig: RetryConfig = {
  max_attempts: 3,
  strategy: "EXPONENTIAL",
  initial_delay_ms: 25,
  max_delay_ms: 500,
  jitter: "FULL"
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
};

const asAttemptHistory = (error: unknown): DLQAttemptRecord[] => {
  if (error instanceof DeliveryExhaustedError) {
    return error.attempt_history.map((entry) => ({
      attempt_number: entry.attempt_number,
      failed_at: entry.failed_at,
      error: toErrorMessage(entry.error)
    }));
  }

  return [
    {
      attempt_number: 1,
      failed_at: new Date().toISOString(),
      error: toErrorMessage(error)
    }
  ];
};

export class ConduitRouter {
  private readonly routeRegistry: RouteRegistry;
  private readonly handlerRegistry: HandlerRegistry;
  private readonly providers: Map<string, ITransportProvider>;
  private readonly dlqManager: IDLQManager | undefined;
  private readonly retryExecutor: RetryExecutor;
  private readonly pipeline: MiddlewarePipeline;

  public constructor(dependencies: RouterDependencies) {
    this.routeRegistry = dependencies.route_registry;
    this.handlerRegistry = dependencies.handler_registry;
    this.providers = dependencies.providers;
    this.dlqManager = dependencies.dlq_manager;
    this.retryExecutor = dependencies.retry_executor ?? new RetryExecutor();
    this.pipeline = new MiddlewarePipeline(dependencies.middlewares);
  }

  public async dispatch(envelope: OperationEnvelope): Promise<DispatchResult> {
    validateEnvelope(envelope);

    const route = this.routeRegistry.resolve(envelope);

    if (isEnvelopeExpired(envelope)) {
      return this.handleExpiredEnvelope(route, envelope);
    }

    const provider = this.providers.get(route.provider);

    if (!provider) {
      throw new ConfigurationError(`Provider ${route.provider} is not registered`);
    }

    const passedBackpressure = await this.handleBackpressure(route, provider);

    if (!passedBackpressure) {
      return {
        operation_id: envelope.operation_id,
        status: "DROPPED",
        provider: provider.name,
        handler_results: [],
        dropped_reason: "Backpressure policy dropped operation"
      };
    }

    const handlers = this.handlerRegistry.resolve(envelope);

    if (handlers.length === 0) {
      return {
        operation_id: envelope.operation_id,
        status: "DELIVERED",
        provider: provider.name,
        handler_results: []
      };
    }

    const handlerResults: HandlerDispatchResult[] = [];

    for (const handler of handlers) {
      const result = await this.dispatchToHandler(provider, route, envelope, handler);
      handlerResults.push(result);
    }

    return {
      operation_id: envelope.operation_id,
      status: this.resolveOverallStatus(handlerResults),
      provider: provider.name,
      handler_results: handlerResults
    };
  }

  private async dispatchToHandler(
    provider: ITransportProvider,
    route: RouteConfig,
    envelope: OperationEnvelope,
    handler: RegisteredHandler
  ): Promise<HandlerDispatchResult> {
    const retryPolicy = toRetryPolicyFromConfig(route.retry, defaultRetryConfig);
    const dispatchResultRef: { status: "DELIVERED" | "QUEUED" } = {
      status: "DELIVERED"
    };

    try {
      const executionResult = await this.retryExecutor.execute(async (attemptNumber) => {
        const envelopeForAttempt: OperationEnvelope = {
          ...envelope,
          metadata: {
            ...envelope.metadata,
            correlation_id:
              envelope.metadata.correlation_id ?? envelope.operation_id,
            attempt_number: attemptNumber,
            ...(route.reply_to || envelope.metadata.reply_to
              ? {
                  reply_to: envelope.metadata.reply_to ?? route.reply_to
                }
              : {})
          }
        };

        await this.pipeline.run(
          {
            envelope: envelopeForAttempt,
            route,
            handler,
            provider,
            provider_name: provider.name
          },
          async () => {
            const request = {
              envelope: envelopeForAttempt,
              route,
              handler
            };

            if (route.timeout_ms !== undefined) {
              const result = await provider.dispatch({
                ...request,
                timeout_ms: route.timeout_ms
              });
              dispatchResultRef.status = result.status;
              return;
            }

            const result = await provider.dispatch({
              ...request
            });
            dispatchResultRef.status = result.status;
          }
        );
      }, retryPolicy);

      return {
        handler_id: handler.id,
        status:
          dispatchResultRef.status === "QUEUED" ? "QUEUED" : "DELIVERED",
        attempts: executionResult.attempts
      };
    } catch (error) {
      if (route.on_exhausted === "RAISE") {
        throw error;
      }

      if (route.on_exhausted === "LOG_AND_DROP") {
        return {
          handler_id: handler.id,
          status: "DROPPED",
          attempts: this.extractAttempts(error),
          error: toErrorMessage(error)
        };
      }

      if (!this.dlqManager) {
        throw new ConfigurationError(
          `Route ${route.operation_name} requires DLQ, but dlq_manager is not configured`
        );
      }

      const attempts = this.extractAttempts(error);

      await this.dlqManager.put({
        id: createUuidV7(),
        envelope,
        route,
        handler_id: handler.id,
        attempts,
        last_error: toErrorMessage(error),
        created_at: new Date().toISOString(),
        attempt_history: asAttemptHistory(error)
      });

      return {
        handler_id: handler.id,
        status: "DLQ",
        attempts,
        error: toErrorMessage(error)
      };
    }
  }

  private async handleBackpressure(
    route: RouteConfig,
    provider: ITransportProvider
  ): Promise<boolean> {
    if (!route.backpressure || !provider.getBacklogSize) {
      return true;
    }

    const policy = route.backpressure;
    const deadline = Date.now() + policy.block_timeout_ms;

    while (Date.now() <= deadline) {
      const backlog = await provider.getBacklogSize(route);

      if (backlog <= policy.outbox_watermark) {
        return true;
      }

      await sleep(25);
    }

    switch (policy.on_overflow) {
      case "DROP":
        return false;
      case "SAMPLE": {
        const sampleRate = policy.sample_rate ?? 0.1;
        return Math.random() <= sampleRate;
      }
      case "RAISE_EXCEPTION":
      default:
        throw new BackpressureError(
          `Backpressure triggered for ${route.operation_name} (${provider.name})`
        );
    }
  }

  private extractAttempts(error: unknown): number {
    if (error instanceof DeliveryExhaustedError) {
      return error.attempts;
    }

    return 1;
  }

  private resolveOverallStatus(results: HandlerDispatchResult[]): DispatchResult["status"] {
    if (results.some((result) => result.status === "DLQ")) {
      return "DLQ";
    }

    if (results.some((result) => result.status === "DROPPED")) {
      return "DROPPED";
    }

    if (results.some((result) => result.status === "FAILED")) {
      return "DROPPED";
    }

    if (results.some((result) => result.status === "QUEUED")) {
      return "QUEUED";
    }

    return "DELIVERED";
  }

  private async handleExpiredEnvelope(
    route: RouteConfig,
    envelope: OperationEnvelope
  ): Promise<DispatchResult> {
    if (route.on_exhausted === "RAISE") {
      throw new ValidationError("Envelope has expired", ["expires_at is in the past"]);
    }

    if (route.on_exhausted === "LOG_AND_DROP") {
      return {
        operation_id: envelope.operation_id,
        status: "DROPPED",
        provider: route.provider,
        handler_results: [],
        dropped_reason: "Envelope TTL expired before delivery"
      };
    }

    if (!this.dlqManager) {
      throw new ConfigurationError(
        `Route ${route.operation_name} requires DLQ, but dlq_manager is not configured`
      );
    }

    await this.dlqManager.put({
      id: createUuidV7(),
      envelope,
      route,
      handler_id: "ttl-expired",
      attempts: 0,
      last_error: "EnvelopeExpired",
      created_at: new Date().toISOString(),
      attempt_history: []
    });

    return {
      operation_id: envelope.operation_id,
      status: "DLQ",
      provider: route.provider,
      handler_results: []
    };
  }
}
