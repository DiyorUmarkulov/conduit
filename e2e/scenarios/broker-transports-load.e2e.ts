import { describe, expect, it } from "vitest";

import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";
import { KafkaJsProducerClient, KafkaProvider } from "@conduit/provider-kafka";
import { NatsJsClient, NatsProvider } from "@conduit/provider-nats";
import {
  AmqplibPublisherClient,
  RabbitMQProvider
} from "@conduit/provider-rabbitmq";

import {
  loadAmqplib,
  loadKafkaJs,
  loadNats,
  parseEnvelopeMessage,
  uniqueSuffix,
  withTimeout
} from "../infrastructure/broker-clients.js";
import {
  brokerEndpoints,
  skipIfNoBrokerStack
} from "../infrastructure/testcontainers-setup.js";

const batchSize = Math.max(
  10,
  Number.parseInt(process.env.CONDUIT_E2E_BROKER_BATCH ?? "100", 10)
);
const consumeTimeoutMs = Math.max(
  10_000,
  Number.parseInt(process.env.CONDUIT_E2E_BROKER_BATCH_TIMEOUT_MS ?? "45000", 10)
);

const dispatchBatch = async (
  dispatchOne: (index: number) => Promise<string>
): Promise<void> => {
  await Promise.all(
    Array.from({ length: batchSize }, async (_, index) => {
      const status = await dispatchOne(index);

      if (status !== "QUEUED") {
        throw new Error(`Expected QUEUED for batch message ${index}, got ${status}`);
      }
    })
  );
};

const collectExpectedIndexes = (): Set<number> =>
  new Set(Array.from({ length: batchSize }, (_, index) => index));

describe("E2E broker transports load", () => {
  it.skipIf(skipIfNoBrokerStack())(
    "delivers full Kafka batch without losses",
    async () => {
      const kafkaJs = await loadKafkaJs();
      const suffix = uniqueSuffix();
      const topic = `conduit.e2e.kafka.load.${suffix}`;
      const operationName = `e2e.kafka.load.${suffix}`;
      const expectedIndexes = collectExpectedIndexes();
      const receivedIndexes = new Set<number>();

      const kafka = new kafkaJs.Kafka({
        brokers: [brokerEndpoints.kafka_bootstrap],
        clientId: `conduit-e2e-kafka-load-${suffix}`
      });
      const admin = kafka.admin();
      const producer = kafka.producer();
      const consumer = kafka.consumer({
        groupId: `conduit-e2e-kafka-load-consumer-${suffix}`
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

        const consumed = new Promise<void>((resolve) => {
          void consumer.run({
            eachMessage: async ({ message }) => {
              const decoded = parseEnvelopeMessage(
                (message.value ?? Buffer.alloc(0)).toString("utf8")
              );
              const payload = decoded.envelope.payload as { index?: unknown };
              const index =
                typeof payload.index === "number" ? payload.index : Number.NaN;

              if (Number.isInteger(index)) {
                receivedIndexes.add(index);
              }

              if (receivedIndexes.size >= batchSize) {
                resolve();
              }
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

        await dispatchBatch(async (index) => {
          const result = await bus.dispatch(
            EnvelopeBuilder.event(operationName, {
              index
            })
              .withSourceService("e2e-load")
              .build()
          );

          return result.status;
        });
        await withTimeout(consumed, consumeTimeoutMs, "Kafka batch consume");

        expect(receivedIndexes.size).toBe(batchSize);
        expect([...receivedIndexes].sort((left, right) => left - right)).toEqual([
          ...expectedIndexes
        ]);
      } finally {
        await consumer.stop().catch(() => undefined);
        await consumer.disconnect().catch(() => undefined);
        await producer.disconnect().catch(() => undefined);
        await admin.disconnect().catch(() => undefined);
      }
    }
  );

  it.skipIf(skipIfNoBrokerStack())(
    "delivers full RabbitMQ batch without losses",
    async () => {
      const amqplib = await loadAmqplib();
      const suffix = uniqueSuffix();
      const operationName = `e2e.rabbit.load.${suffix}`;
      const routingKey = `event.${operationName}`;
      const expectedIndexes = collectExpectedIndexes();
      const receivedIndexes = new Set<number>();

      const connection = await amqplib.connect(brokerEndpoints.rabbitmq_url);
      const publisherChannel = await connection.createConfirmChannel();
      const consumerChannel = await connection.createChannel();

      try {
        await consumerChannel.assertExchange("conduit.operations", "topic", {
          durable: true
        });
        const queue = await consumerChannel.assertQueue("", {
          durable: false,
          exclusive: true,
          autoDelete: true
        });
        await consumerChannel.bindQueue(queue.queue, "conduit.operations", routingKey);

        const consumed = new Promise<void>((resolve) => {
          void consumerChannel.consume(
            queue.queue,
            (message) => {
              if (!message) {
                return;
              }

              consumerChannel.ack(message);
              const decoded = parseEnvelopeMessage(message.content.toString("utf8"));
              const payload = decoded.envelope.payload as { index?: unknown };
              const index =
                typeof payload.index === "number" ? payload.index : Number.NaN;

              if (Number.isInteger(index)) {
                receivedIndexes.add(index);
              }

              if (receivedIndexes.size >= batchSize) {
                resolve();
              }
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

        await dispatchBatch(async (index) => {
          const result = await bus.dispatch(
            EnvelopeBuilder.event(operationName, {
              index
            })
              .withSourceService("e2e-load")
              .build()
          );

          return result.status;
        });
        await withTimeout(consumed, consumeTimeoutMs, "RabbitMQ batch consume");

        expect(receivedIndexes.size).toBe(batchSize);
        expect([...receivedIndexes].sort((left, right) => left - right)).toEqual([
          ...expectedIndexes
        ]);
      } finally {
        await consumerChannel.close().catch(() => undefined);
        await publisherChannel.close().catch(() => undefined);
        await connection.close().catch(() => undefined);
      }
    }
  );

  it.skipIf(skipIfNoBrokerStack())(
    "delivers full NATS batch without losses",
    async () => {
      const nats = await loadNats();
      const suffix = uniqueSuffix();
      const operationName = `e2e.nats.load.${suffix}`;
      const subject = `event.${operationName}`;
      const expectedIndexes = collectExpectedIndexes();
      const receivedIndexes = new Set<number>();

      const connection = await nats.connect({
        servers: brokerEndpoints.nats_url,
        name: `conduit-e2e-nats-load-${suffix}`
      });
      const codec = nats.StringCodec();

      try {
        const subscription = connection.subscribe(subject, {
          max: batchSize
        });

        const consumed = (async (): Promise<void> => {
          for await (const message of subscription) {
            const decoded = parseEnvelopeMessage(codec.decode(message.data));
            const payload = decoded.envelope.payload as { index?: unknown };
            const index =
              typeof payload.index === "number" ? payload.index : Number.NaN;

            if (Number.isInteger(index)) {
              receivedIndexes.add(index);
            }

            if (receivedIndexes.size >= batchSize) {
              return;
            }
          }

          throw new Error("NATS subscription closed before full batch");
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

        await dispatchBatch(async (index) => {
          const result = await bus.dispatch(
            EnvelopeBuilder.event(operationName, {
              index
            })
              .withSourceService("e2e-load")
              .build()
          );

          return result.status;
        });
        await withTimeout(consumed, consumeTimeoutMs, "NATS batch consume");

        expect(receivedIndexes.size).toBe(batchSize);
        expect([...receivedIndexes].sort((left, right) => left - right)).toEqual([
          ...expectedIndexes
        ]);
      } finally {
        await connection.close().catch(() => undefined);
      }
    }
  );
});
