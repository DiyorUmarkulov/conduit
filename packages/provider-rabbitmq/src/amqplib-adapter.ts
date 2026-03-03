import type { IRabbitPublisherClient, RabbitPublishInput } from "./rabbitmq-provider.js";

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
