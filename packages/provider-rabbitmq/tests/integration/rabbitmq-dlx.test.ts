import { describe, expect, it } from "vitest";

import amqplib from "amqplib";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import {
  AmqplibPublisherClient,
  RabbitMQConsumer,
  RabbitMQExchangeTopology,
  RabbitMQProvider,
  RabbitMQQueueTopology
} from "../../src/index.js";

const shouldRun =
  process.env.CONDUIT_E2E_BROKERS === "1" ||
  process.env.CONDUIT_RABBITMQ_URL;

const describeIf = shouldRun ? describe : describe.skip;

const rabbitUrl = process.env.CONDUIT_RABBITMQ_URL ?? "amqp://localhost:5672";

const waitFor = async <T>(
  check: () => Promise<T | undefined>,
  timeoutMs = 10_000
): Promise<T> => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const value = await check();
    if (value) {
      return value;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Timed out waiting for condition");
};

const createRequest = (): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.event("payment.failed", { payment_id: "p-1" })
    .withSourceService("billing")
    .build(),
  route: {
    operation_name: "payment.failed",
    operation_type: "EVENT",
    provider: "RABBITMQ",
    on_exhausted: "DLQ"
  },
  handler: {
    id: "handler-1",
    operation_name: "payment.failed",
    operation_type: "EVENT",
    version_range: ">=1.0.0 <2.0.0",
    handle: async () => ({ ok: true })
  }
});

describeIf("RabbitMQ DLX integration", () => {
  it("nacks messages into DLQ", async () => {
    const connection = await amqplib.connect(rabbitUrl);
    const channel = await connection.createConfirmChannel();

    const exchange = `conduit.it.${Date.now()}`;
    const queue = `conduit.queue.${Date.now()}`;
    const dlx = `${exchange}.dlx`;
    const dlq = `${queue}.dlq`;

    const exchangeTopology = new RabbitMQExchangeTopology(channel as any);
    const queueTopology = new RabbitMQQueueTopology(channel as any);

    await exchangeTopology.ensure({ name: exchange, type: "topic" });
    await exchangeTopology.ensure({ name: dlx, type: "direct" });

    await queueTopology.ensure(
      {
        name: queue,
        arguments: {
          "x-dead-letter-exchange": dlx,
          "x-dead-letter-routing-key": "dlq"
        }
      },
      [{ queue, exchange, routing_key: "event.payment.failed" }]
    );

    await queueTopology.ensure(
      { name: dlq },
      [{ queue: dlq, exchange: dlx, routing_key: "dlq" }]
    );

    const provider = new RabbitMQProvider(
      new AmqplibPublisherClient(channel as any),
      { exchange }
    );

    const consumer = new RabbitMQConsumer(channel as any, {
      queue,
      prefetch: 1,
      requeue_on_error: false,
      handler: async () => {
        throw new Error("boom");
      }
    });

    await consumer.start();

    try {
      await provider.dispatch(createRequest());

      const dlqMessage = await waitFor(async () => {
        const message = await channel.get(dlq, { noAck: true });
        return message ?? undefined;
      });

      expect(dlqMessage?.content).toBeDefined();
    } finally {
      await consumer.stop();
      await channel.close();
      await connection.close();
    }
  });
});
