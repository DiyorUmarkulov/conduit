export interface KafkaTopicConfigEntry {
  name: string;
  value: string;
}

export interface KafkaTopicConfig {
  topic: string;
  partitions?: number;
  replication_factor?: number;
  config_entries?: KafkaTopicConfigEntry[];
}

export interface KafkaTopicMetadata {
  name: string;
  partitions: Array<{
    partitionId: number;
    replicas?: Array<unknown>;
  }>;
}

export interface KafkaDescribeConfigEntry {
  name: string;
  value?: string | null;
}

export interface KafkaDescribeConfigResult {
  resources: Array<{
    configEntries?: KafkaDescribeConfigEntry[];
  }>;
}

export interface KafkaAdminClient {
  listTopics(): Promise<string[]>;
  createTopics(input: {
    topics: KafkaTopicConfig[];
    waitForLeaders?: boolean;
  }): Promise<boolean>;
  fetchTopicMetadata(input: {
    topics: string[];
  }): Promise<{ topics: KafkaTopicMetadata[] }>;
  describeConfigs?(input: {
    resources: Array<{ type: "topic" | string; name: string }>;
  }): Promise<KafkaDescribeConfigResult[]>;
}

export interface KafkaAdminOptions {
  create_missing?: boolean;
  validate_partitions?: boolean;
  validate_replication?: boolean;
  validate_config_entries?: boolean;
}

const findTopic = (
  metadata: KafkaTopicMetadata[] | undefined,
  topic: string
): KafkaTopicMetadata | undefined => metadata?.find((entry) => entry.name === topic);

export class KafkaAdmin {
  private readonly createMissing: boolean;
  private readonly validatePartitions: boolean;
  private readonly validateReplication: boolean;
  private readonly validateConfigEntries: boolean;

  public constructor(
    private readonly admin: KafkaAdminClient,
    options: KafkaAdminOptions = {}
  ) {
    this.createMissing = options.create_missing ?? true;
    this.validatePartitions = options.validate_partitions ?? true;
    this.validateReplication = options.validate_replication ?? false;
    this.validateConfigEntries = options.validate_config_entries ?? false;
  }

  public async ensureTopic(config: KafkaTopicConfig): Promise<void> {
    const topics = await this.admin.listTopics();

    if (!topics.includes(config.topic)) {
      if (!this.createMissing) {
        throw new Error(`Kafka topic ${config.topic} is missing`);
      }

      await this.admin.createTopics({
        topics: [config],
        waitForLeaders: true
      });
      return;
    }

    const metadata = await this.admin.fetchTopicMetadata({
      topics: [config.topic]
    });

    const topic = findTopic(metadata.topics, config.topic);

    if (!topic) {
      return;
    }

    if (this.validatePartitions && config.partitions !== undefined) {
      const partitionCount = topic.partitions.length;

      if (partitionCount < config.partitions) {
        throw new Error(
          `Kafka topic ${config.topic} has ${partitionCount} partitions, expected ${config.partitions}`
        );
      }
    }

    if (this.validateReplication && config.replication_factor !== undefined) {
      const replicas = topic.partitions
        .map((partition) => partition.replicas?.length ?? 0)
        .reduce((min, current) => Math.min(min, current), Infinity);

      if (
        Number.isFinite(replicas) &&
        replicas < config.replication_factor
      ) {
        throw new Error(
          `Kafka topic ${config.topic} has replication factor ${replicas}, expected ${config.replication_factor}`
        );
      }
    }

    if (
      this.validateConfigEntries &&
      config.config_entries &&
      this.admin.describeConfigs
    ) {
      await this.assertConfigEntries(config);
    }
  }

  public async ensureTopics(configs: KafkaTopicConfig[]): Promise<void> {
    for (const config of configs) {
      await this.ensureTopic(config);
    }
  }

  private async assertConfigEntries(config: KafkaTopicConfig): Promise<void> {
    if (!this.admin.describeConfigs || !config.config_entries) {
      return;
    }

    const response = await this.admin.describeConfigs({
      resources: [{ type: "topic", name: config.topic }]
    });

    const entries = response[0]?.resources?.[0]?.configEntries ?? [];
    const lookup = new Map(entries.map((entry) => [entry.name, entry.value ?? ""]));

    for (const expected of config.config_entries) {
      const actual = lookup.get(expected.name);

      if (actual === undefined) {
        throw new Error(
          `Kafka topic ${config.topic} missing config ${expected.name}`
        );
      }

      if (String(actual) !== String(expected.value)) {
        throw new Error(
          `Kafka topic ${config.topic} config ${expected.name}=${actual} does not match ${expected.value}`
        );
      }
    }
  }
}
