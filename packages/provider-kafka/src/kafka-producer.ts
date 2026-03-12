import type { IKafkaProducerClient, KafkaMessage } from "./kafka-provider.js";

export interface KafkaProducerSendInput {
  topic: string;
  messages: Array<{
    key?: string;
    value: string | Buffer;
    headers?: Record<string, string>;
  }>;
}

export interface KafkaTransactionLike {
  send(input: KafkaProducerSendInput): Promise<unknown>;
  commit(): Promise<void>;
  abort(): Promise<void>;
}

export interface KafkaProducerLike {
  send(input: KafkaProducerSendInput): Promise<unknown>;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  transaction?(): Promise<KafkaTransactionLike>;
}

export interface KafkaProducerOptions {
  transactional?: boolean;
  ensure_connected?: boolean;
}

const toBufferValue = (value: string | Uint8Array): string | Buffer => {
  if (typeof value === "string") {
    return value;
  }

  return Buffer.from(value);
};

export class KafkaProducer implements IKafkaProducerClient {
  private readonly transactional: boolean;
  private readonly ensureConnected: boolean;
  private connected = false;

  public constructor(
    private readonly producer: KafkaProducerLike,
    options: KafkaProducerOptions = {}
  ) {
    this.transactional = options.transactional ?? false;
    this.ensureConnected = options.ensure_connected ?? false;
  }

  public async send(message: KafkaMessage): Promise<void> {
    if (this.ensureConnected) {
      await this.connect();
    }

    const payload: KafkaProducerSendInput = {
      topic: message.topic,
      messages: [
        {
          ...(message.key ? { key: message.key } : {}),
          value: toBufferValue(message.value),
          ...(message.headers ? { headers: message.headers } : {})
        }
      ]
    };

    if (!this.transactional) {
      await this.producer.send(payload);
      return;
    }

    if (!this.producer.transaction) {
      throw new Error("Kafka producer does not support transactions");
    }

    const transaction = await this.producer.transaction();

    try {
      await transaction.send(payload);
      await transaction.commit();
    } catch (error) {
      await transaction.abort();
      throw error;
    }
  }

  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.producer.connect) {
      await this.producer.connect();
    }

    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    if (this.producer.disconnect) {
      await this.producer.disconnect();
    }

    this.connected = false;
  }
}
