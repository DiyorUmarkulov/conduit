import type { INatsClient, NatsPublishInput } from "./nats-provider.js";

export interface NatsJsHeadersLike {
  set(key: string, value: string): void;
}

export interface NatsJsConnectionLike {
  publish(
    subject: string,
    payload?: Uint8Array,
    options?: {
      headers?: NatsJsHeadersLike;
    }
  ): void;
  flush(): Promise<void>;
}

export interface NatsJsHeadersFactory {
  (): NatsJsHeadersLike;
}

const textEncoder = new TextEncoder();

const toBytes = (payload: string | Uint8Array): Uint8Array => {
  if (typeof payload === "string") {
    return textEncoder.encode(payload);
  }

  return payload;
};

export class NatsJsClient implements INatsClient {
  public constructor(
    private readonly connection: NatsJsConnectionLike,
    private readonly createHeaders: NatsJsHeadersFactory
  ) {}

  public async publish(input: NatsPublishInput): Promise<void> {
    const headers = this.createHeaders();

    for (const [key, value] of Object.entries(input.headers ?? {})) {
      headers.set(key, value);
    }

    this.connection.publish(input.subject, toBytes(input.payload), {
      headers
    });
    await this.connection.flush();
  }
}
