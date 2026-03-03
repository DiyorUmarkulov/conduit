import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";
import { KafkaJsProducerClient, KafkaProvider } from "@conduit/provider-kafka";
import { NatsJsClient, NatsProvider } from "@conduit/provider-nats";
import {
  AmqplibPublisherClient,
  RabbitMQProvider
} from "@conduit/provider-rabbitmq";

import {
  brokerEndpoints,
  skipIfNoBrokerStack
} from "../infrastructure/testcontainers-setup.js";

const withTimeout = async <T>(
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

const uniqueSuffix = (): string => `${Date.now()}-${randomUUID().slice(0, 8)}`;

const loadKafkaJs = async (): Promise<{
  Kafka: new (options: {
    brokers: string[];
    clientId: string;
  }) => {
    admin(): {
      connect(): Promise<void>;
      disconnect(): Promise<void>;
      createTopics(options: {
        waitForLeaders: boolean;
        topics: Array<{ topic: string; numPartitions: number; replicationFactor: number }>;
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
        eachMessage(args: {
          message: { value?: Buffer | null };
        }): Promise<void>;
      }): Promise<void>;
      stop(): Promise<void>;
    };
  };
}> => {
  try {
    return (await import("kafkajs")) as {
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
          subscribe(options: {
            topic: string;
            fromBeginning: boolean;
          }): Promise<void>;
          run(options: {
            eachMessage(args: {
              message: { value?: Buffer | null };
            }): Promise<void>;
          }): Promise<void>;
          stop(): Promise<void>;
        };
      };
    };
  } catch (error) {
    throw new Error(
      `kafkajs is required for broker e2e tests. Install with pnpm add -Dw kafkajs. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

const loadAmqplib = async (): Promise<{
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
}> => {
  try {
    const module = (await import("amqplib")) as {
      connect?: (url: string) => Promise<unknown>;
      default?: { connect?: (url: string) => Promise<unknown> };
    };

    const connect =
      typeof module.connect === "function"
        ? module.connect
        : module.default?.connect;

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
  } catch (error) {
    throw new Error(
      `amqplib is required for broker e2e tests. Install with pnpm add -Dw amqplib. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

const loadNats = async (): Promise<{
  connect(options: { servers: string; name: string }): Promise<{
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
  }>;
  headers: () => { set(key: string, value: string): void };
  StringCodec: () => { decode(data: Uint8Array): string };
}> => {
  try {
    const module = (await import("nats")) as {
      connect?: (options: { servers: string; name: string }) => Promise<unknown>;
      headers?: () => { set(key: string, value: string): void };
      StringCodec?: () => { decode(data: Uint8Array): string };
      default?: {
        connect?: (options: { servers: string; name: string }) => Promise<unknown>;
        headers?: () => { set(key: string, value: string): void };
        StringCodec?: () => { decode(data: Uint8Array): string };
      };
    };

    const connect =
      typeof module.connect === "function"
        ? module.connect
        : module.default?.connect;
    const headers =
      typeof module.headers === "function"
        ? module.headers
        : module.default?.headers;
    const StringCodec =
      typeof module.StringCodec === "function"
        ? module.StringCodec
        : module.default?.StringCodec;

    if (!connect || !headers || !StringCodec) {
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
      StringCodec
    };
  } catch (error) {
    throw new Error(
      `nats is required for broker e2e tests. Install with pnpm add -Dw nats. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

describe("E2E broker transports", () => {
  it.skipIf(skipIfNoBrokerStack())(
    "publishes event envelope to Kafka topic via KafkaProvider",
    async () => {
      const kafkajs = await loadKafkaJs();
      const suffix = uniqueSuffix();
      const topic = `conduit.e2e.kafka.${suffix}`;
      const operationName = `e2e.kafka.${suffix}`;
      const payload = {
        sku: "sku-kafka",
        quantity: 7
      };

      const kafka = new kafkajs.Kafka({
        brokers: [brokerEndpoints.kafka_bootstrap],
        clientId: `conduit-e2e-kafka-${suffix}`
      });
      const admin = kafka.admin();
      const producer = kafka.producer();
      const consumer = kafka.consumer({
        groupId: `conduit-e2e-consumer-${suffix}`
      });

      try {
        await admin.connect();
        await admin.createTopics({
          waitForLeaders: true,
          topics: [
            {
              topic,
              numPartitions: 1,
              replicationFactor: 1
            }
          ]
        });
        await producer.connect();
        await consumer.connect();

        await consumer.subscribe({
          topic,
          fromBeginning: true
        });

        let resolved = false;
        const received = new Promise<string>((resolve) => {
          void consumer.run({
            eachMessage: async ({ message }) => {
              if (resolved) {
                return;
              }

              resolved = true;
              resolve((message.value ?? Buffer.alloc(0)).toString("utf8"));
            }
          });
        });

        const builder = new ConduitBuilder();
        builder
          .addRoute(builder.route(operationName).type("EVENT").via("KAFKA"))
          .registerProvider(
            new KafkaProvider(new KafkaJsProducerClient(producer), {
              topic_resolver: () => topic
            })
          );

        const bus = builder.build();
        bus.registerEventHandler(operationName, async () => undefined);

        const dispatchResult = await bus.dispatch(
          EnvelopeBuilder.event(operationName, payload)
            .withSourceService("e2e")
            .build()
        );

        expect(dispatchResult.status).toBe("QUEUED");

        const rawMessage = await withTimeout(received, 15_000, "Kafka consume");
        const decoded = JSON.parse(rawMessage) as {
          envelope: {
            operation_name: string;
            payload: unknown;
          };
        };

        expect(decoded.envelope.operation_name).toBe(operationName);
        expect(decoded.envelope.payload).toEqual(payload);
      } finally {
        await consumer.stop().catch(() => undefined);
        await consumer.disconnect().catch(() => undefined);
        await producer.disconnect().catch(() => undefined);
        await admin.disconnect().catch(() => undefined);
      }
    }
  );

  it.skipIf(skipIfNoBrokerStack())(
    "publishes event envelope to RabbitMQ exchange via RabbitMQProvider",
    async () => {
      const amqplib = await loadAmqplib();
      const suffix = uniqueSuffix();
      const operationName = `e2e.rabbit.${suffix}`;
      const routingKey = `event.${operationName}`;
      const payload = {
        sku: "sku-rabbit",
        quantity: 3
      };

      const connection = await amqplib.connect(brokerEndpoints.rabbitmq_url);
      const publisherChannel = await connection.createConfirmChannel();
      const consumerChannel = await connection.createChannel();

      try {
        await consumerChannel.assertExchange("conduit.operations", "topic", {
          durable: true
        });
        const assertedQueue = await consumerChannel.assertQueue("", {
          durable: false,
          exclusive: true,
          autoDelete: true
        });
        await consumerChannel.bindQueue(
          assertedQueue.queue,
          "conduit.operations",
          routingKey
        );

        const consumed = new Promise<string>((resolve) => {
          void consumerChannel.consume(
            assertedQueue.queue,
            (message) => {
              if (!message) {
                return;
              }

              consumerChannel.ack(message);
              resolve(message.content.toString("utf8"));
            },
            {
              noAck: false
            }
          );
        });

        const builder = new ConduitBuilder();
        builder
          .addRoute(builder.route(operationName).type("EVENT").via("RABBITMQ"))
          .registerProvider(
            new RabbitMQProvider(new AmqplibPublisherClient(publisherChannel))
          );

        const bus = builder.build();
        bus.registerEventHandler(operationName, async () => undefined);

        const dispatchResult = await bus.dispatch(
          EnvelopeBuilder.event(operationName, payload)
            .withSourceService("e2e")
            .build()
        );

        expect(dispatchResult.status).toBe("QUEUED");

        const rawMessage = await withTimeout(consumed, 15_000, "RabbitMQ consume");
        const decoded = JSON.parse(rawMessage) as {
          envelope: {
            operation_name: string;
            payload: unknown;
          };
        };

        expect(decoded.envelope.operation_name).toBe(operationName);
        expect(decoded.envelope.payload).toEqual(payload);
      } finally {
        await consumerChannel.close().catch(() => undefined);
        await publisherChannel.close().catch(() => undefined);
        await connection.close().catch(() => undefined);
      }
    }
  );

  it.skipIf(skipIfNoBrokerStack())(
    "publishes event envelope to NATS subject via NatsProvider",
    async () => {
      const nats = await loadNats();
      const suffix = uniqueSuffix();
      const operationName = `e2e.nats.${suffix}`;
      const subject = `event.${operationName}`;
      const payload = {
        sku: "sku-nats",
        quantity: 5
      };

      const connection = await nats.connect({
        servers: brokerEndpoints.nats_url,
        name: `conduit-e2e-nats-${suffix}`
      });
      const codec = nats.StringCodec();

      try {
        const subscription = connection.subscribe(subject, {
          max: 1
        });

        const consumed = (async (): Promise<string> => {
          for await (const message of subscription) {
            return codec.decode(message.data);
          }

          throw new Error("NATS subscription closed without messages");
        })();

        const builder = new ConduitBuilder();
        builder
          .addRoute(builder.route(operationName).type("EVENT").via("NATS"))
          .registerProvider(
            new NatsProvider(new NatsJsClient(connection, nats.headers), {
              subject_resolver: () => subject
            })
          );

        const bus = builder.build();
        bus.registerEventHandler(operationName, async () => undefined);

        const dispatchResult = await bus.dispatch(
          EnvelopeBuilder.event(operationName, payload)
            .withSourceService("e2e")
            .build()
        );

        expect(dispatchResult.status).toBe("QUEUED");

        const rawMessage = await withTimeout(consumed, 15_000, "NATS consume");
        const decoded = JSON.parse(rawMessage) as {
          envelope: {
            operation_name: string;
            payload: unknown;
          };
        };

        expect(decoded.envelope.operation_name).toBe(operationName);
        expect(decoded.envelope.payload).toEqual(payload);
      } finally {
        await connection.close().catch(() => undefined);
      }
    }
  );
});

