import type { KafkaAdminClient } from "./kafka-admin.js";
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
  listTopics?(): Promise<string[]>;
  createTopics?(input: { topics: Array<{ topic: string; numPartitions?: number; replicationFactor?: number; configEntries?: Array<{ name: string; value: string }> }>; waitForLeaders?: boolean }): Promise<boolean>;
  fetchTopicMetadata?(input: { topics: string[] }): Promise<{ topics: Array<{ name: string; partitions: Array<{ partitionId: number; replicas?: Array<unknown> }> }> }>;
  describeConfigs?(input: { resources: Array<{ type: string; name: string }> }): Promise<Array<{ resources: Array<{ configEntries?: Array<{ name: string; value?: string | null }> }> }>>;
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

export class KafkaJsAdminClient implements KafkaAdminClient {
  public constructor(private readonly admin: KafkaJsAdminLike) {}

  public async listTopics(): Promise<string[]> {
    if (!this.admin.listTopics) {
      throw new Error("Kafka admin does not support listTopics");
    }

    return this.admin.listTopics();
  }

  public async createTopics(input: { topics: Array<{ topic: string; partitions?: number; replication_factor?: number; config_entries?: Array<{ name: string; value: string }> }>; waitForLeaders?: boolean }): Promise<boolean> {
    if (!this.admin.createTopics) {
      throw new Error("Kafka admin does not support createTopics");
    }

    return this.admin.createTopics({
      topics: input.topics.map((topic) => ({
        topic: topic.topic,
        ...(topic.partitions !== undefined ? { numPartitions: topic.partitions } : {}),
        ...(topic.replication_factor !== undefined
          ? { replicationFactor: topic.replication_factor }
          : {}),
        ...(topic.config_entries !== undefined
          ? { configEntries: topic.config_entries }
          : {})
      })),
      ...(input.waitForLeaders !== undefined ? { waitForLeaders: input.waitForLeaders } : {})
    });
  }

  public async fetchTopicMetadata(input: { topics: string[] }): Promise<{ topics: Array<{ name: string; partitions: Array<{ partitionId: number; replicas?: Array<unknown> }> }> }> {
    if (!this.admin.fetchTopicMetadata) {
      throw new Error("Kafka admin does not support fetchTopicMetadata");
    }

    return this.admin.fetchTopicMetadata({ topics: input.topics });
  }

  public async describeConfigs(input: {
    resources: Array<{ type: "topic" | string; name: string }>;
  }): Promise<Array<{ resources: Array<{ configEntries?: Array<{ name: string; value?: string | null }> }> }>> {
    if (!this.admin.describeConfigs) {
      return [];
    }

    return this.admin.describeConfigs({ resources: input.resources });
  }
}
