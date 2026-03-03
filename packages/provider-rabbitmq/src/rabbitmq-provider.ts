import type {
  ITransportProvider,
  ProviderDispatchRequest,
  ProviderDispatchResult,
  RouteConfig
} from "@conduit/core";

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
}

const defaultSerializer = (request: ProviderDispatchRequest): string =>
  JSON.stringify({
    envelope: request.envelope,
    route: request.route,
    handler_id: request.handler.id,
    emitted_at: new Date().toISOString()
  });

export class RabbitMQProvider implements ITransportProvider {
  public readonly name = "RABBITMQ";

  private readonly exchange: string;
  private readonly resolveRoutingKey: (request: ProviderDispatchRequest) => string;
  private readonly serialize: (request: ProviderDispatchRequest) => Uint8Array | string;

  public constructor(
    private readonly publisher: IRabbitPublisherClient,
    private readonly options: RabbitMQProviderOptions = {}
  ) {
    this.exchange = options.exchange ?? "conduit.operations";
    this.resolveRoutingKey =
      options.routing_key_resolver ??
      ((request) => `${request.route.operation_type.toLowerCase()}.${request.route.operation_name}`);
    this.serialize = options.serializer ?? defaultSerializer;
  }

  public async dispatch(
    request: ProviderDispatchRequest
  ): Promise<ProviderDispatchResult> {
    const routingKey = this.resolveRoutingKey(request);

    await this.publisher.publish({
      exchange: this.exchange,
      routing_key: routingKey,
      payload: this.serialize(request),
      headers: {
        trace_id: request.envelope.metadata.trace_id,
        operation_id: request.envelope.operation_id
      },
      persistent: true
    });

    return {
      status: "QUEUED"
    };
  }

  public async getBacklogSize(route: RouteConfig): Promise<number> {
    if (!this.options.backlog_reader) {
      return 0;
    }

    const routingKey = `${route.operation_type.toLowerCase()}.${route.operation_name}`;
    return this.options.backlog_reader.pending(this.exchange, routingKey);
  }
}
