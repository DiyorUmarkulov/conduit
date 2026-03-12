import { describe, expect, it } from "vitest";

import { connect, consumerOpts, headers } from "nats";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import {
  NatsJetStreamConsumer,
  NatsJetStreamProvider,
  NatsJsJetStreamClient
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
  envelope: EnvelopeBuilder.command("inventory.adjust", { sku: "sku-1" })
    .withSourceService("inventory")
    .withIdempotencyKey("idem-1")
    .build(),
  route: {
    operation_name: "inventory.adjust",
    operation_type: "COMMAND",
    provider: "NATS_JETSTREAM",
    on_exhausted: "DLQ"
  },
  handler: {
    id: `handler-${subject}`,
    operation_name: "inventory.adjust",
    operation_type: "COMMAND",
    version_range: ">=1.0.0 <2.0.0",
    handle: async () => ({ ok: true })
  }
});

describeIf("NATS JetStream provider integration", () => {
  it("publishes and consumes a message", async () => {
    const nc = await connect({ servers: natsUrl });
    const js = nc.jetstream();
    const jsm = await nc.jetstreamManager();

    const subject = `conduit.js.${Date.now()}`;
    const stream = `conduit-stream-${Date.now()}`;

    try {
      await jsm.streams.add({ name: stream, subjects: [subject] });
    } catch {
      // ignore if exists
    }

    const provider = new NatsJetStreamProvider(
      new NatsJsJetStreamClient(js as any, headers),
      {
        subject_resolver: () => subject
      }
    );

    let received: any;

    const opts = consumerOpts();
    opts.durable(`durable-${Date.now()}`);
    opts.manualAck();
    opts.ackExplicit();

    const consumer = new NatsJetStreamConsumer(js as any, {
      subject,
      subscribe_options: opts as any,
      handler: async (payload) => {
        received = payload;
      }
    });

    await consumer.start();

    try {
      await provider.dispatch(createRequest(subject));
      await waitFor(() => Boolean(received));
      expect(received?.envelope?.operation_name).toBe("inventory.adjust");
    } finally {
      await consumer.stop();
      await nc.close();
    }
  });
});
