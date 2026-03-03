import type { KafkaMessage, IKafkaLagReader, IKafkaProducerClient } from "./kafka-provider.js";

export interface KafkaJsProducerLike {
  send(input: {
    topic: string;
    messages: Array<{
      key?: string;
      value: string | Buffer;
      headers?: Record<string, string>;
    }>;
  }): Promise<unknown>;
}

export interface KafkaJsAdminLike {
  fetchTopicOffsets(topic: string): Promise<
    Array<{
      partition: number;
      high: string;
      low?: string;
    }>
  >;
}

const toBufferValue = (value: string | Uint8Array): string | Buffer => {
  if (typeof value === "string") {
    return value;
  }

  return Buffer.from(value);
};

export class KafkaJsProducerClient implements IKafkaProducerClient {
  public constructor(private readonly producer: KafkaJsProducerLike) {}

  public async send(message: KafkaMessage): Promise<void> {
    await this.producer.send({
      topic: message.topic,
      messages: [
        {
          ...(message.key ? { key: message.key } : {}),
          value: toBufferValue(message.value),
          ...(message.headers ? { headers: message.headers } : {})
        }
      ]
    });
  }
}

export class KafkaJsLagReader implements IKafkaLagReader {
  public constructor(private readonly admin: KafkaJsAdminLike) {}

  public async getLag(topic: string): Promise<number> {
    const offsets = await this.admin.fetchTopicOffsets(topic);

    let lag = 0;

    for (const offset of offsets) {
      const high = Number(offset.high);
      const low = offset.low !== undefined ? Number(offset.low) : 0;

      if (Number.isFinite(high) && Number.isFinite(low) && high >= low) {
        lag += Math.max(0, high - low);
      }
    }

    return lag;
  }
}
