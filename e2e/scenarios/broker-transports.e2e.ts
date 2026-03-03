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

const consumeTimeoutMs = Number.parseInt(
  process.env.CONDUIT_E2E_BROKER_CONSUME_TIMEOUT_MS ?? "15000",
  10
);

describe("E2E broker transports", () => {
  it.skipIf(skipIfNoBrokerStack())(
    "publishes event envelope to Kafka topic via KafkaProvider",
    async () => {
      const kafkaJs = await loadKafkaJs();
      const suffix = uniqueSuffix();
      const topic = `conduit.e2e.kafka.${suffix}`;
      const operationName = `e2e.kafka.${suffix}`;
      const payload = {
        sku: "sku-kafka",
        quantity: 7
      };

      const kafka = new kafkaJs.Kafka({
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
        const consumed = new Promise<string>((resolve) => {
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

        const rawMessage = await withTimeout(consumed, consumeTimeoutMs, "Kafka consume");
        const decoded = parseEnvelopeMessage(rawMessage);

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
        const queue = await consumerChannel.assertQueue("", {
          durable: false,
          exclusive: true,
          autoDelete: true
        });
        await consumerChannel.bindQueue(queue.queue, "conduit.operations", routingKey);

        const consumed = new Promise<string>((resolve) => {
          void consumerChannel.consume(
            queue.queue,
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

        const rawMessage = await withTimeout(consumed, consumeTimeoutMs, "RabbitMQ consume");
        const decoded = parseEnvelopeMessage(rawMessage);

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

        const rawMessage = await withTimeout(consumed, consumeTimeoutMs, "NATS consume");
        const decoded = parseEnvelopeMessage(rawMessage);

        expect(decoded.envelope.operation_name).toBe(operationName);
        expect(decoded.envelope.payload).toEqual(payload);
      } finally {
        await connection.close().catch(() => undefined);
      }
    }
  );
});

