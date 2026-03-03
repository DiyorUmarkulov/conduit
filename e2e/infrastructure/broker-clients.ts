import { randomUUID } from "node:crypto";

export interface ParsedEnvelopeMessage {
  envelope: {
    operation_name: string;
    payload: unknown;
  };
}

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

export const uniqueSuffix = (): string => `${Date.now()}-${randomUUID().slice(0, 8)}`;

export const parseEnvelopeMessage = (raw: string): ParsedEnvelopeMessage =>
  JSON.parse(raw) as ParsedEnvelopeMessage;

const dynamicImport = async <T>(
  specifier: string,
  installHint: string
): Promise<T> => {
  try {
    return (await import(specifier)) as T;
  } catch (error) {
    throw new Error(
      `${specifier} is required for broker e2e tests. Install with ${installHint}. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export interface KafkaJsRuntime {
  Kafka: new (options: {
    brokers: string[];
    clientId: string;
  }) => {
    admin(): {
      connect(): Promise<void>;
      disconnect(): Promise<void>;
      createTopics(options: {
        waitForLeaders: boolean;
        topics: Array<{
          topic: string;
          numPartitions: number;
          replicationFactor: number;
        }>;
      }): Promise<boolean>;
    };
    producer(): {
      connect(): Promise<void>;
      disconnect(): Promise<void>;
      send(input: {
        topic: string;
        messages: Array<{
          key?: string;
          value: string | Buffer;
          headers?: Record<string, string>;
        }>;
      }): Promise<unknown>;
    };
    consumer(options: { groupId: string }): {
      connect(): Promise<void>;
      disconnect(): Promise<void>;
      subscribe(options: { topic: string; fromBeginning: boolean }): Promise<void>;
      run(options: {
        eachMessage(args: { message: { value?: Buffer | null } }): Promise<void>;
      }): Promise<void>;
      stop(): Promise<void>;
    };
  };
}

export const loadKafkaJs = async (): Promise<KafkaJsRuntime> =>
  dynamicImport<KafkaJsRuntime>("kafkajs", "pnpm add -Dw kafkajs");

export interface AmqplibRuntime {
  connect(url: string): Promise<{
    createConfirmChannel(): Promise<{
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
      waitForConfirms(): Promise<void>;
      close(): Promise<void>;
    }>;
    createChannel(): Promise<{
      assertExchange(
        exchange: string,
        type: string,
        options?: { durable?: boolean }
      ): Promise<unknown>;
      assertQueue(
        queue: string,
        options?: { durable?: boolean; exclusive?: boolean; autoDelete?: boolean }
      ): Promise<{ queue: string }>;
      bindQueue(queue: string, exchange: string, routingKey: string): Promise<unknown>;
      consume(
        queue: string,
        onMessage: (message: { content: Buffer } | null) => void,
        options?: { noAck?: boolean }
      ): Promise<{ consumerTag: string }>;
      ack(message: { content: Buffer }): void;
      close(): Promise<void>;
    }>;
    close(): Promise<void>;
  }>;
}

export const loadAmqplib = async (): Promise<AmqplibRuntime> => {
  const module = await dynamicImport<{
    connect?: (url: string) => Promise<unknown>;
    default?: { connect?: (url: string) => Promise<unknown> };
  }>("amqplib", "pnpm add -Dw amqplib");

  const connect =
    typeof module.connect === "function" ? module.connect : module.default?.connect;

  if (!connect) {
    throw new Error("amqplib.connect export not found");
  }

  return {
    connect: async (url: string) =>
      (await connect(url)) as {
        createConfirmChannel(): Promise<{
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
          waitForConfirms(): Promise<void>;
          close(): Promise<void>;
        }>;
        createChannel(): Promise<{
          assertExchange(
            exchange: string,
            type: string,
            options?: { durable?: boolean }
          ): Promise<unknown>;
          assertQueue(
            queue: string,
            options?: { durable?: boolean; exclusive?: boolean; autoDelete?: boolean }
          ): Promise<{ queue: string }>;
          bindQueue(queue: string, exchange: string, routingKey: string): Promise<unknown>;
          consume(
            queue: string,
            onMessage: (message: { content: Buffer } | null) => void,
            options?: { noAck?: boolean }
          ): Promise<{ consumerTag: string }>;
          ack(message: { content: Buffer }): void;
          close(): Promise<void>;
        }>;
        close(): Promise<void>;
      }
  };
};

export interface NatsRuntime {
  connect(options: { servers: string; name: string }): Promise<{
    publish(
      subject: string,
      payload?: Uint8Array,
      options?: { headers?: { set(key: string, value: string): void } }
    ): void;
    flush(): Promise<void>;
    subscribe(subject: string, options: { max: number }): AsyncIterable<{ data: Uint8Array }>;
    close(): Promise<void>;
  }>;
  headers: () => { set(key: string, value: string): void };
  StringCodec: () => { decode(data: Uint8Array): string };
}

export const loadNats = async (): Promise<NatsRuntime> => {
  const module = await dynamicImport<{
    connect?: (options: { servers: string; name: string }) => Promise<unknown>;
    headers?: () => { set(key: string, value: string): void };
    StringCodec?: () => { decode(data: Uint8Array): string };
    default?: {
      connect?: (options: { servers: string; name: string }) => Promise<unknown>;
      headers?: () => { set(key: string, value: string): void };
      StringCodec?: () => { decode(data: Uint8Array): string };
    };
  }>("nats", "pnpm add -Dw nats");

  const connect =
    typeof module.connect === "function" ? module.connect : module.default?.connect;
  const headers =
    typeof module.headers === "function" ? module.headers : module.default?.headers;
  const stringCodec =
    typeof module.StringCodec === "function"
      ? module.StringCodec
      : module.default?.StringCodec;

  if (!connect || !headers || !stringCodec) {
    throw new Error("nats exports connect/headers/StringCodec are not available");
  }

  return {
    connect: async (options: { servers: string; name: string }) =>
      (await connect(options)) as {
        publish(
          subject: string,
          payload?: Uint8Array,
          options?: { headers?: { set(key: string, value: string): void } }
        ): void;
        flush(): Promise<void>;
        subscribe(
          subject: string,
          options: { max: number }
        ): AsyncIterable<{ data: Uint8Array }>;
        close(): Promise<void>;
      },
    headers,
    StringCodec: stringCodec
  };
};

