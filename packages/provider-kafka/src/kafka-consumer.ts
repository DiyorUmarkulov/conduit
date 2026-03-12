import type { OperationEnvelope } from "@conduit/core";

import {
  deserializeConduitMessage,
  type ConduitKafkaMessage
} from "./serialization/json.serializer.js";

export interface KafkaConsumerMessage {
  key?: string | Uint8Array;
  value?: string | Uint8Array | null;
  headers?: Record<string, string | Uint8Array | Buffer | undefined>;
  offset: string;
  timestamp?: string;
}

export interface KafkaEachMessagePayload {
  topic: string;
  partition: number;
  message: KafkaConsumerMessage;
  heartbeat?: () => Promise<void>;
  pause?: () => void;
}

export interface KafkaConsumerClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(input: { topic: string; fromBeginning?: boolean }): Promise<void>;
  run(input: {
    autoCommit?: boolean;
    eachMessage: (payload: KafkaEachMessagePayload) => Promise<void>;
  }): Promise<void>;
  stop?(): Promise<void>;
  commitOffsets?(offsets: Array<{ topic: string; partition: number; offset: string }>);
}

export interface KafkaConsumerContext {
  topic: string;
  partition: number;
  offset: string;
  key?: string | Uint8Array;
  timestamp?: string;
  headers?: Record<string, string | Uint8Array | Buffer | undefined>;
  raw: KafkaEachMessagePayload;
}

export interface KafkaConsumerOptions<TMessage = ConduitKafkaMessage> {
  topics: string[];
  from_beginning?: boolean;
  auto_commit?: boolean;
  commit_on_success?: boolean;
  commit_on_error?: boolean;
  deserializer?: (payload: KafkaEachMessagePayload) => Promise<TMessage> | TMessage;
  handler: (message: TMessage, context: KafkaConsumerContext) => Promise<void> | void;
  on_error?: (
    error: unknown,
    context: KafkaConsumerContext & { message?: TMessage }
  ) => Promise<void> | void;
}

const toNextOffset = (offset: string): string => {
  const value = Number(offset);

  if (!Number.isFinite(value)) {
    return offset;
  }

  return String(value + 1);
};

const defaultDeserializer = (payload: KafkaEachMessagePayload): ConduitKafkaMessage => {
  const value = payload.message.value;

  if (value === null || value === undefined) {
    throw new Error("Kafka message has no value");
  }

  return deserializeConduitMessage(value as string | Uint8Array);
};

export class KafkaConsumer<TMessage = ConduitKafkaMessage> {
  private running = false;
  private runPromise?: Promise<void>;

  private readonly topics: string[];
  private readonly fromBeginning: boolean;
  private readonly autoCommit: boolean;
  private readonly commitOnSuccess: boolean;
  private readonly commitOnError: boolean;
  private readonly deserialize: (
    payload: KafkaEachMessagePayload
  ) => Promise<TMessage> | TMessage;
  private readonly handler: (
    message: TMessage,
    context: KafkaConsumerContext
  ) => Promise<void> | void;
  private readonly onError?: (
    error: unknown,
    context: KafkaConsumerContext & { message?: TMessage }
  ) => Promise<void> | void;

  public constructor(
    private readonly consumer: KafkaConsumerClient,
    options: KafkaConsumerOptions<TMessage>
  ) {
    this.topics = options.topics;
    this.fromBeginning = options.from_beginning ?? false;
    this.autoCommit = options.auto_commit ?? true;
    this.commitOnSuccess = options.commit_on_success ?? true;
    this.commitOnError = options.commit_on_error ?? false;
    this.deserialize = options.deserializer ?? (defaultDeserializer as any);
    this.handler = options.handler;
    this.onError = options.on_error;
  }

  public async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    await this.consumer.connect();

    for (const topic of this.topics) {
      await this.consumer.subscribe({
        topic,
        fromBeginning: this.fromBeginning
      });
    }

    this.runPromise = this.consumer
      .run({
      autoCommit: this.autoCommit,
      eachMessage: async (payload) => {
        const context: KafkaConsumerContext = {
          topic: payload.topic,
          partition: payload.partition,
          offset: payload.message.offset,
          key: payload.message.key,
          timestamp: payload.message.timestamp,
          headers: payload.message.headers,
          raw: payload
        };

        try {
          const decoded = await this.deserialize(payload);
          await this.handler(decoded, context);

          if (!this.autoCommit && this.commitOnSuccess) {
            await this.commitOffset(context);
          }
        } catch (error) {
          if (this.onError) {
            const decoded = await this.safeDeserialize(payload);
            await this.onError(error, { ...context, ...(decoded ? { message: decoded } : {}) });

            if (!this.autoCommit && this.commitOnError) {
              await this.commitOffset(context);
            }

            return;
          }

          throw error;
        }
      }
    })
      .finally(() => {
        this.running = false;
      });

    this.runPromise.catch(() => undefined);
  }

  public async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.consumer.stop) {
      await this.consumer.stop();
    }

    await this.consumer.disconnect();
    if (this.runPromise) {
      await this.runPromise;
    }
    this.running = false;
  }

  public isRunning(): boolean {
    return this.running;
  }

  private async commitOffset(context: KafkaConsumerContext): Promise<void> {
    if (!this.consumer.commitOffsets) {
      return;
    }

    await this.consumer.commitOffsets([
      {
        topic: context.topic,
        partition: context.partition,
        offset: toNextOffset(context.offset)
      }
    ]);
  }

  private async safeDeserialize(
    payload: KafkaEachMessagePayload
  ): Promise<TMessage | undefined> {
    try {
      return await this.deserialize(payload);
    } catch {
      return undefined;
    }
  }
}

export const toEnvelope = (
  message: ConduitKafkaMessage
): OperationEnvelope => message.envelope;
