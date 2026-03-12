import { describe, expect, it } from "vitest";

import { Kafka } from "kafkajs";

import { EnvelopeBuilder } from "@conduit/core";

import {
  KafkaAdmin,
  KafkaConsumer,
  KafkaDLQManager,
  KafkaJsAdminClient,
  KafkaJsProducerClient
} from "../../src/index.js";

const shouldRun =
  process.env.CONDUIT_E2E_BROKERS === "1" ||
  process.env.CONDUIT_KAFKA_BOOTSTRAP;

const describeIf = shouldRun ? describe : describe.skip;

const bootstrap = process.env.CONDUIT_KAFKA_BOOTSTRAP ?? "localhost:9092";

const waitFor = async (check: () => boolean, timeoutMs = 10_000): Promise<void> => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (check()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Timed out waiting for condition");
};

describeIf("Kafka DLQ integration", () => {
  it("publishes DLQ entry to topic", async () => {
    const kafka = new Kafka({
      clientId: "conduit-kafka-dlq-it",
      brokers: [bootstrap]
    });

    const topic = `conduit.dlq.it.${Date.now()}`;
    const admin = kafka.admin();
    const producer = kafka.producer();
    const consumer = kafka.consumer({ groupId: `conduit-dlq-it-${Date.now()}` });

    await admin.connect();
    const adminClient = new KafkaJsAdminClient(admin as any);
    const topicAdmin = new KafkaAdmin(adminClient);
    await topicAdmin.ensureTopic({ topic, partitions: 1 });

    await producer.connect();

    const dlq = new KafkaDLQManager(new KafkaJsProducerClient(producer as any), {
      topic
    });

    let received: any;

    const dlqConsumer = new KafkaConsumer(consumer as any, {
      topics: [topic],
      from_beginning: true,
      deserializer: (payload) => {
        const value = payload.message.value;
        if (!value) {
          return undefined as any;
        }
        return JSON.parse(new TextDecoder().decode(value as Uint8Array));
      },
      handler: async (message) => {
        received = message;
      }
    });

    await dlqConsumer.start();

    try {
      await dlq.put({
        id: "dlq-1",
        envelope: EnvelopeBuilder.command("order.create", { order_id: "o-1" })
          .withSourceService("api")
          .withIdempotencyKey("idem-1")
          .build(),
        route: {
          operation_name: "order.create",
          operation_type: "COMMAND",
          provider: "KAFKA",
          on_exhausted: "DLQ"
        },
        handler_id: "handler-1",
        attempts: 1,
        last_error: "boom",
        created_at: new Date().toISOString(),
        attempt_history: []
      });

      await waitFor(() => Boolean(received));
      expect(received?.handler_id).toBe("handler-1");
      expect(received?.route?.operation_name).toBe("order.create");
    } finally {
      await dlqConsumer.stop();
      await producer.disconnect();
      await admin.disconnect();
    }
  });
});
