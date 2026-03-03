import type { DispatchResult } from "./types/result.js";
import type { OperationEnvelope } from "./types/envelope.js";
import type { OperationHandler } from "./types/handler.js";
import { ConduitRouter } from "./router/conduit-router.js";
import { HandlerRegistry } from "./router/handler-registry.js";
import type { ICorrelationStore } from "./correlation/correlation-store.js";

const DEFAULT_VERSION_RANGE = ">=1.0.0 <2.0.0";

export interface EventHandlerOptions {
  version_range?: string;
  consumer_group?: string;
}

export interface CommandHandlerOptions {
  version_range?: string;
}

export interface DispatchAndWaitOptions {
  timeout_ms?: number;
  correlation_id?: string;
  signal?: AbortSignal;
}

export interface DispatchAndReplyResult {
  dispatch_result: DispatchResult;
  reply: OperationEnvelope;
}

export class ConduitBus {
  public constructor(
    private readonly router: ConduitRouter,
    private readonly handlerRegistry: HandlerRegistry,
    private readonly correlationStore?: ICorrelationStore
  ) {}

  public async dispatch(envelope: OperationEnvelope): Promise<DispatchResult> {
    return this.router.dispatch(envelope);
  }

  public async dispatchAndWaitForReply(
    envelope: OperationEnvelope,
    options: DispatchAndWaitOptions = {}
  ): Promise<DispatchAndReplyResult> {
    if (!this.correlationStore) {
      throw new Error(
        "Correlation store is not configured. Use ConduitBuilder.withCorrelationStore()"
      );
    }

    const correlationId =
      options.correlation_id ??
      envelope.metadata.correlation_id ??
      envelope.operation_id;

    const envelopeWithCorrelation: OperationEnvelope = {
      ...envelope,
      metadata: {
        ...envelope.metadata,
        correlation_id: correlationId
      }
    };

    const waitOptions = {
      ...(options.timeout_ms !== undefined
        ? { timeout_ms: options.timeout_ms }
        : {}),
      ...(options.signal !== undefined
        ? { signal: options.signal }
        : {})
    };

    const replyPromise = this.correlationStore.waitForReply(
      correlationId,
      waitOptions
    );

    try {
      const dispatchResult = await this.dispatch(envelopeWithCorrelation);
      const reply = await replyPromise;

      return {
        dispatch_result: dispatchResult,
        reply
      };
    } catch (error) {
      this.correlationStore.reject(correlationId, error);
      throw error;
    }
  }

  public resolveReply(envelope: OperationEnvelope): boolean {
    if (!this.correlationStore) {
      return false;
    }

    return this.correlationStore.resolve(envelope);
  }

  public registerCommandHandler(
    operationName: string,
    handler: OperationHandler,
    options: CommandHandlerOptions = {}
  ): string {
    return this.handlerRegistry.registerCommand(
      operationName,
      options.version_range ?? DEFAULT_VERSION_RANGE,
      handler
    );
  }

  public registerEventHandler(
    operationName: string,
    handler: OperationHandler,
    options: EventHandlerOptions = {}
  ): string {
    const registrationOptions =
      options.consumer_group !== undefined
        ? { consumer_group: options.consumer_group }
        : {};

    return this.handlerRegistry.registerEvent(
      operationName,
      options.version_range ?? DEFAULT_VERSION_RANGE,
      handler,
      registrationOptions
    );
  }
}
