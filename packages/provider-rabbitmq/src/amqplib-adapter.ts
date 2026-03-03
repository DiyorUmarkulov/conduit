import type { IRabbitPublisherClient, RabbitPublishInput } from "./rabbitmq-provider.js";
import type { RabbitMQChannelPool } from "./rabbitmq-channel-pool.js";

export interface AmqplibConfirmChannelLike {
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: {
      headers?: Record<string, string>;
      persistent?: boolean;
      messageId?: string;
      contentType?: string;
    }
  ): boolean;
  waitForConfirms?(): Promise<void>;
  close?(): Promise<void> | void;
  once?(
    event: "close" | "error",
    listener: (error?: unknown) => void
  ): AmqplibConfirmChannelLike;
  on?(
    event: "close" | "error",
    listener: (error?: unknown) => void
  ): AmqplibConfirmChannelLike;
  removeListener?(
    event: "close" | "error",
    listener: (error?: unknown) => void
  ): AmqplibConfirmChannelLike;
}

const toBuffer = (payload: string | Uint8Array): Buffer => {
  if (typeof payload === "string") {
    return Buffer.from(payload, "utf8");
  }

  return Buffer.from(payload);
};

export class AmqplibPublisherClient implements IRabbitPublisherClient {
  public constructor(private readonly channel: AmqplibConfirmChannelLike) {}

  public async publish(input: RabbitPublishInput): Promise<void> {
    const ok = this.channel.publish(
      input.exchange,
      input.routing_key,
      toBuffer(input.payload),
      {
        ...(input.headers ? { headers: input.headers } : {}),
        ...(input.persistent !== undefined ? { persistent: input.persistent } : {}),
        contentType: "application/json"
      }
    );

    if (!ok) {
      throw new Error("AMQP publish buffer is saturated");
    }

    if (this.channel.waitForConfirms) {
      await this.channel.waitForConfirms();
    }
  }
}

export class PooledAmqplibPublisherClient implements IRabbitPublisherClient {
  public constructor(
    private readonly pool: RabbitMQChannelPool<AmqplibConfirmChannelLike>
  ) {}

  public async publish(input: RabbitPublishInput): Promise<void> {
    await this.pool.withChannel(async (channel) => {
      try {
        const ok = channel.publish(
          input.exchange,
          input.routing_key,
          toBuffer(input.payload),
          {
            ...(input.headers ? { headers: input.headers } : {}),
            ...(input.persistent !== undefined ? { persistent: input.persistent } : {}),
            contentType: "application/json"
          }
        );

        if (!ok) {
          throw new Error("AMQP publish buffer is saturated");
        }

        if (channel.waitForConfirms) {
          await channel.waitForConfirms();
        }
      } catch (error) {
        await this.pool.invalidate(channel);
        throw error;
      }
    });
  }
}
