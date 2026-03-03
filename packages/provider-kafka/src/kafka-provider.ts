import type {
  ITransportProvider,
  ProviderDispatchRequest,
  ProviderDispatchResult,
  RetryConfig,
  RouteConfig
} from "@conduit/core";
import { createUuidV7 } from "@conduit/core";

import { DispatchResilience, type DispatchResilienceOptions } from "./internal/resilience.js";

export interface KafkaMessage {
  topic: string;
  key?: string;
  value: Uint8Array | string;
  headers?: Record<string, string>;
}

export interface IKafkaProducerClient {
  send(message: KafkaMessage): Promise<void>;
}

export interface IKafkaLagReader {
  getLag(topic: string): Promise<number> | number;
}

export interface KafkaProviderOptions {
  topic_resolver?: (request: ProviderDispatchRequest) => string;
  key_resolver?: (request: ProviderDispatchRequest) => string | undefined;
  headers_resolver?: (request: ProviderDispatchRequest) => Record<string, string>;
  serializer?: (request: ProviderDispatchRequest) => Uint8Array | string;
  lag_reader?: IKafkaLagReader;
  default_retry?: RetryConfig;
  publish_timeout_ms?: number;
  max_in_flight?: number;
  circuit_breaker?: DispatchResilienceOptions["circuit_breaker"];
  now?: () => number;
  random?: () => number;
}

const defaultTopicResolver = (request: ProviderDispatchRequest): string =>
  `conduit.${request.route.operation_type.toLowerCase()}.${request.route.operation_name}`;

const defaultSerializer = (request: ProviderDispatchRequest): string =>
  JSON.stringify({
    envelope: request.envelope,
    route: request.route,
    handler_id: request.handler.id,
    emitted_at: new Date().toISOString()
  });

const defaultHeadersResolver = (
  request: ProviderDispatchRequest
): Record<string, string> => ({
  operation_name: request.envelope.operation_name,
  operation_type: request.envelope.operation_type,
  trace_id: request.envelope.metadata.trace_id,
  operation_id: request.envelope.operation_id,
  handler_id: request.handler.id,
  source_service: request.envelope.metadata.source_service,
  schema_version: request.envelope.schema_version,
  attempt_number: String(request.envelope.metadata.attempt_number ?? 1),
  produced_at: new Date().toISOString()
});

export class KafkaProvider implements ITransportProvider {
  public readonly name = "KAFKA";

  private readonly resolveTopic: (request: ProviderDispatchRequest) => string;
  private readonly resolveKey: (request: ProviderDispatchRequest) => string | undefined;
  private readonly resolveHeaders: (request: ProviderDispatchRequest) => Record<string, string>;
  private readonly serialize: (request: ProviderDispatchRequest) => Uint8Array | string;
  private readonly resilience: DispatchResilience;

  public constructor(
    private readonly producer: IKafkaProducerClient,
    private readonly options: KafkaProviderOptions = {}
  ) {
    this.resolveTopic = options.topic_resolver ?? defaultTopicResolver;
    this.resolveKey =
      options.key_resolver ??
      ((request) => request.envelope.metadata.idempotency_key ?? request.envelope.operation_id);
    this.resolveHeaders = options.headers_resolver ?? defaultHeadersResolver;
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
    const topic = this.resolveTopic(request);
    const key = this.resolveKey(request);

    await this.resilience.run(
      async () => {
        const headers = {
          ...this.resolveHeaders(request),
          message_id: createUuidV7()
        };

        await this.producer.send({
          topic,
          ...(key ? { key } : {}),
          value: this.serialize(request),
          headers
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

    if (!this.options.lag_reader) {
      return inFlight;
    }

    const topic = `conduit.${route.operation_type.toLowerCase()}.${route.operation_name}`;
    const lag = await this.options.lag_reader.getLag(topic);
    return Math.max(0, lag) + inFlight;
  }
}
