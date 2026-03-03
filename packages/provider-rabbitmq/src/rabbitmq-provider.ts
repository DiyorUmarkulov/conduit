import type {
  ITransportProvider,
  ProviderDispatchRequest,
  ProviderDispatchResult,
  RetryConfig,
  RouteConfig
} from "@conduit/core";
import { createUuidV7 } from "@conduit/core";

import { DispatchResilience, type DispatchResilienceOptions } from "./internal/resilience.js";

export interface RabbitPublishInput {
  exchange: string;
  routing_key: string;
  payload: Uint8Array | string;
  headers?: Record<string, string>;
  persistent?: boolean;
}

export interface IRabbitPublisherClient {
  publish(input: RabbitPublishInput): Promise<void>;
}

export interface RabbitBacklogReader {
  pending(exchange: string, routingKey: string): Promise<number> | number;
}

export interface RabbitMQProviderOptions {
  exchange?: string;
  routing_key_resolver?: (request: ProviderDispatchRequest) => string;
  serializer?: (request: ProviderDispatchRequest) => Uint8Array | string;
  backlog_reader?: RabbitBacklogReader;
  default_retry?: RetryConfig;
  publish_timeout_ms?: number;
  max_in_flight?: number;
  circuit_breaker?: DispatchResilienceOptions["circuit_breaker"];
  now?: () => number;
  random?: () => number;
}

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

export class RabbitMQProvider implements ITransportProvider {
  public readonly name = "RABBITMQ";

  private readonly exchange: string;
  private readonly resolveRoutingKey: (request: ProviderDispatchRequest) => string;
  private readonly serialize: (request: ProviderDispatchRequest) => Uint8Array | string;
  private readonly resilience: DispatchResilience;

  public constructor(
    private readonly publisher: IRabbitPublisherClient,
    private readonly options: RabbitMQProviderOptions = {}
  ) {
    this.exchange = options.exchange ?? "conduit.operations";
    this.resolveRoutingKey =
      options.routing_key_resolver ??
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
    const routingKey = this.resolveRoutingKey(request);

    await this.resilience.run(
      async () => {
        await this.publisher.publish({
          exchange: this.exchange,
          routing_key: routingKey,
          payload: this.serialize(request),
          headers: defaultHeaders(request),
          persistent: true
        });
      },
      request.route.retry,
      request.timeout_ms
    );

    return {
      status: "QUEUED"
    };
  }

  public async getBacklogSize(route: RouteConfig): Promise<number> {
    const inFlight = this.resilience.getInFlight();

    if (!this.options.backlog_reader) {
      return inFlight;
    }

    const routingKey = `${route.operation_type.toLowerCase()}.${route.operation_name}`;
    const backlog = await this.options.backlog_reader.pending(this.exchange, routingKey);
    return Math.max(0, backlog) + inFlight;
  }
}
