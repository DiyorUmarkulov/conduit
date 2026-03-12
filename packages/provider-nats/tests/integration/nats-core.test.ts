import { describe, expect, it } from "vitest";

import { connect, headers } from "nats";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import {
  NatsCoreConsumer,
  NatsCoreProvider,
  NatsJsClient
} from "../../src/index.js";

const shouldRun =
  process.env.CONDUIT_E2E_BROKERS === "1" || process.env.CONDUIT_NATS_URL;

const describeIf = shouldRun ? describe : describe.skip;

const natsUrl = process.env.CONDUIT_NATS_URL ?? "nats://localhost:4222";

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

const createRequest = (subject: string): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.event("order.created", { order_id: "o-1" })
    .withSourceService("orders")
    .build(),
  route: {
    operation_name: "order.created",
    operation_type: "EVENT",
    provider: "NATS",
    on_exhausted: "DLQ"
  },
  handler: {
    id: `handler-${subject}`,
    operation_name: "order.created",
    operation_type: "EVENT",
    version_range: ">=1.0.0 <2.0.0",
    handle: async () => ({ ok: true })
  }
});

describeIf("NATS core provider integration", () => {
  it("publishes and consumes a message", async () => {
    const nc = await connect({ servers: natsUrl });
    const subject = `conduit.it.${Date.now()}`;

    const provider = new NatsCoreProvider(
      new NatsJsClient(nc, headers),
      {
        subject_resolver: () => subject
      }
    );

    let received: any;

    const consumer = new NatsCoreConsumer(nc, {
      subject,
      handler: async (payload) => {
        received = payload;
      }
    });

    await consumer.start();

    try {
      await provider.dispatch(createRequest(subject));
      await waitFor(() => Boolean(received));
      expect(received?.envelope?.operation_name).toBe("order.created");
    } finally {
      await consumer.stop();
      await nc.close();
    }
  });
});
