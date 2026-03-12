import { describe, expect, it } from "vitest";

import { Kafka } from "kafkajs";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import {
  KafkaAdmin,
  KafkaConsumer,
  KafkaJsAdminClient,
  KafkaJsProducerClient,
  KafkaProvider
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

const createRequest = (topic: string): ProviderDispatchRequest => ({
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
  handler: {
    id: `handler-${topic}`,
    operation_name: "order.create",
    operation_type: "COMMAND",
    version_range: ">=1.0.0 <2.0.0",
    handle: async () => ({ ok: true })
  }
});

describeIf("Kafka provider integration", () => {
  it("publishes and consumes a message", async () => {
    const kafka = new Kafka({
      clientId: "conduit-kafka-it",
      brokers: [bootstrap]
    });

    const topic = `conduit.it.${Date.now()}`;
    const admin = kafka.admin();
    const producer = kafka.producer();
    const consumer = kafka.consumer({ groupId: `conduit-it-${Date.now()}` });

    await admin.connect();
    const adminClient = new KafkaJsAdminClient(admin as any);
    const topicAdmin = new KafkaAdmin(adminClient);
    await topicAdmin.ensureTopic({ topic, partitions: 1 });

    await producer.connect();

    const provider = new KafkaProvider(new KafkaJsProducerClient(producer as any), {
      topic_resolver: () => topic
    });

    let received: { envelope: { operation_name: string } } | undefined;

    const conduitConsumer = new KafkaConsumer(consumer as any, {
      topics: [topic],
      from_beginning: true,
      handler: async (message) => {
        received = message as any;
      }
    });

    await conduitConsumer.start();

    try {
      await provider.dispatch(createRequest(topic));
      await waitFor(() => Boolean(received));
      expect(received?.envelope.operation_name).toBe("order.create");
    } finally {
      await conduitConsumer.stop();
      await producer.disconnect();
      await admin.disconnect();
    }
  });
});
