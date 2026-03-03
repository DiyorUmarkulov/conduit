import type {
  ITransportProvider,
  ProviderDispatchRequest,
  ProviderDispatchResult,
  RouteConfig
} from "@conduit/core";

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
}

const defaultSerializer = (request: ProviderDispatchRequest): string =>
  JSON.stringify({
    envelope: request.envelope,
    route: request.route,
    handler_id: request.handler.id,
    emitted_at: new Date().toISOString()
  });

export class NatsProvider implements ITransportProvider {
  public readonly name = "NATS";

  private readonly resolveSubject: (request: ProviderDispatchRequest) => string;
  private readonly serialize: (request: ProviderDispatchRequest) => Uint8Array | string;

  public constructor(
    private readonly client: INatsClient,
    private readonly options: NatsProviderOptions = {}
  ) {
    this.resolveSubject =
      options.subject_resolver ??
      ((request) => `${request.route.operation_type.toLowerCase()}.${request.route.operation_name}`);
    this.serialize = options.serializer ?? defaultSerializer;
  }

  public async dispatch(
    request: ProviderDispatchRequest
  ): Promise<ProviderDispatchResult> {
    const subject = this.resolveSubject(request);

    await this.client.publish({
      subject,
      payload: this.serialize(request),
      headers: {
        trace_id: request.envelope.metadata.trace_id,
        operation_id: request.envelope.operation_id
      }
    });

    return {
      status: "QUEUED"
    };
  }

  public async getBacklogSize(route: RouteConfig): Promise<number> {
    if (!this.options.backlog_reader) {
      return 0;
    }

    const subject = `${route.operation_type.toLowerCase()}.${route.operation_name}`;
    return this.options.backlog_reader.pending(subject);
  }
}
