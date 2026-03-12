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

const createRequest = (): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.event("order.created", { order_id: "o-1" })
    .withSourceService("orders")
    .build(),
  route: {
    operation_name: "order.created",
    operation_type: "EVENT",
    provider: "RABBITMQ",
    on_exhausted: "DLQ"
  },
  handler: {
    id: "handler-1",
    operation_name: "order.created",
    operation_type: "EVENT",
    version_range: ">=1.0.0 <2.0.0",
    handle: async () => ({ ok: true })
  }
});

describeIf("RabbitMQ provider integration", () => {
  it("publishes and consumes a message", async () => {
    const connection = await amqplib.connect(rabbitUrl);
    const channel = await connection.createConfirmChannel();

    const exchange = `conduit.it.${Date.now()}`;
    const queue = `conduit.queue.${Date.now()}`;

    const exchangeTopology = new RabbitMQExchangeTopology(channel as any);
    const queueTopology = new RabbitMQQueueTopology(channel as any);

    await exchangeTopology.ensure({ name: exchange, type: "topic" });
    await queueTopology.ensure(
      { name: queue },
      [{ queue, exchange, routing_key: "event.order.created" }]
    );

    const provider = new RabbitMQProvider(
      new AmqplibPublisherClient(channel as any),
      {
        exchange
      }
    );

    let received: any;

    const consumer = new RabbitMQConsumer(channel as any, {
      queue,
      prefetch: 1,
      handler: async (payload) => {
        received = payload;
      }
    });

    await consumer.start();

    try {
      await provider.dispatch(createRequest());
      await waitFor(() => Boolean(received));
      expect(received?.envelope?.operation_name).toBe("order.created");
    } finally {
      await consumer.stop();
      await channel.close();
      await connection.close();
    }
  });
});
