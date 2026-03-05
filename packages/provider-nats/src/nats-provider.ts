import type {
  ITransportProvider,
  ProviderDispatchRequest,
  ProviderDispatchResult,
  RetryConfig,
  RouteConfig
} from "@conduit/core";
import { createUuidV7, PROVIDER_DISPATCH_STATUSES } from "@conduit/core";

import { DispatchResilience, type DispatchResilienceOptions } from "./internal/resilience.js";

export interface NatsPublishInput {
  subject: string;
  payload: Uint8Array | string;
  headers?: Record<string, string>;
}

export interface INatsClient {
  publish(input: NatsPublishInput): Promise<void>;
}

export interface NatsBacklogReader {
  pending(subject: string): Promise<number> | number;
}

export interface NatsProviderOptions {
  subject_resolver?: (request: ProviderDispatchRequest) => string;
  serializer?: (request: ProviderDispatchRequest) => Uint8Array | string;
  backlog_reader?: NatsBacklogReader;
  default_retry?: RetryConfig;
  publish_timeout_ms?: number;
  max_in_flight?: number;
  circuit_breaker?: DispatchResilienceOptions["circuit_breaker"];
  now?: () => number;
  random?: () => number;
}

export const NATS_PROVIDER_NAME = "NATS" as const;

const defaultSerializer = (request: ProviderDispatchRequest): string =>
  JSON.stringify({
    envelope: request.envelope,
    route: request.route,
    handler_id: request.handler.id,
    emitted_at: new Date().toISOString()
  });

const defaultHeaders = (request: ProviderDispatchRequest): Record<string, string> => ({
  trace_id: request.envelope.metadata.trace_id,
  operation_id: request.envelope.operation_id,
  operation_name: request.envelope.operation_name,
  operation_type: request.envelope.operation_type,
  source_service: request.envelope.metadata.source_service,
  schema_version: request.envelope.schema_version,
  handler_id: request.handler.id,
  attempt_number: String(request.envelope.metadata.attempt_number ?? 1),
  message_id: createUuidV7()
});

export class NatsProvider implements ITransportProvider {
  public readonly name = NATS_PROVIDER_NAME;

  private readonly resolveSubject: (request: ProviderDispatchRequest) => string;
  private readonly serialize: (request: ProviderDispatchRequest) => Uint8Array | string;
  private readonly resilience: DispatchResilience;

  public constructor(
    private readonly client: INatsClient,
    private readonly options: NatsProviderOptions = {}
  ) {
    this.resolveSubject =
      options.subject_resolver ??
      ((request) => `${request.route.operation_type.toLowerCase()}.${request.route.operation_name}`);
    this.serialize = options.serializer ?? defaultSerializer;
    this.resilience = new DispatchResilience({
      ...(options.default_retry ? { retry: options.default_retry } : {}),
      ...(options.publish_timeout_ms !== undefined
        ? { timeout_ms: options.publish_timeout_ms }
        : {}),
      ...(options.max_in_flight !== undefined
        ? { max_in_flight: options.max_in_flight }
        : {}),
      ...(options.circuit_breaker ? { circuit_breaker: options.circuit_breaker } : {}),
      ...(options.now ? { now: options.now } : {}),
      ...(options.random ? { random: options.random } : {})
    });
  }

  public async dispatch(
    request: ProviderDispatchRequest
  ): Promise<ProviderDispatchResult> {
    const subject = this.resolveSubject(request);

    await this.resilience.run(
      async () => {
        await this.client.publish({
          subject,
          payload: this.serialize(request),
          headers: defaultHeaders(request)
        });
      },
      request.route.retry,
      request.timeout_ms
    );

    return {
      status: PROVIDER_DISPATCH_STATUSES.QUEUED
    };
  }

  public async getBacklogSize(route: RouteConfig): Promise<number> {
    const inFlight = this.resilience.getInFlight();

    if (!this.options.backlog_reader) {
      return inFlight;
    }

    const subject = `${route.operation_type.toLowerCase()}.${route.operation_name}`;
    const backlog = await this.options.backlog_reader.pending(subject);
    return Math.max(0, backlog) + inFlight;
  }
}
