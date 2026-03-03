import type {
  ITransportProvider,
  ProviderDispatchRequest,
  ProviderDispatchResult,
  RouteConfig
} from "@conduit/core";

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

export class KafkaProvider implements ITransportProvider {
  public readonly name = "KAFKA";

  private readonly resolveTopic: (request: ProviderDispatchRequest) => string;
  private readonly resolveKey: (request: ProviderDispatchRequest) => string | undefined;
  private readonly resolveHeaders: (request: ProviderDispatchRequest) => Record<string, string>;
  private readonly serialize: (request: ProviderDispatchRequest) => Uint8Array | string;

  public constructor(
    private readonly producer: IKafkaProducerClient,
    private readonly options: KafkaProviderOptions = {}
  ) {
    this.resolveTopic = options.topic_resolver ?? defaultTopicResolver;
    this.resolveKey = options.key_resolver ?? ((request) => request.envelope.operation_id);
    this.resolveHeaders =
      options.headers_resolver ??
      ((request) => ({
        operation_name: request.envelope.operation_name,
        operation_type: request.envelope.operation_type,
        trace_id: request.envelope.metadata.trace_id
      }));
    this.serialize = options.serializer ?? defaultSerializer;
  }

  public async dispatch(
    request: ProviderDispatchRequest
  ): Promise<ProviderDispatchResult> {
    const topic = this.resolveTopic(request);
    const key = this.resolveKey(request);

    await this.producer.send({
      topic,
      ...(key ? { key } : {}),
      value: this.serialize(request),
      headers: this.resolveHeaders(request)
    });

    return {
      status: "QUEUED"
    };
  }

  public async getBacklogSize(route: RouteConfig): Promise<number> {
    if (!this.options.lag_reader) {
      return 0;
    }

    const topic = `conduit.${route.operation_type.toLowerCase()}.${route.operation_name}`;
    return this.options.lag_reader.getLag(topic);
  }
}
