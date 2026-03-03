import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { InMemoryOutboxAdapter } from "../../src/adapters/inmemory-adapter.js";
import { OutboxDLQManager } from "../../src/outbox-dlq.js";
import { OutboxProvider } from "../../src/outbox-provider.js";
import { OutboxRelay } from "../../src/outbox-relay.js";

const buildBaseRequest = (
  handler: ProviderDispatchRequest["handler"]
): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.command("payment.charge", { payment_id: "p-1" })
    .withSourceService("api-gateway")
    .withIdempotencyKey("idem-p-1")
    .build(),
  route: {
    operation_name: "payment.charge",
    operation_type: "COMMAND",
    provider: "OUTBOX",
    on_exhausted: "DLQ",
    retry: {
      max_attempts: 2,
      strategy: "FIXED",
      initial_delay_ms: 0
    }
  },
  handler
});

describe("OutboxRelay", () => {
  it("retries transient error and eventually delivers", async () => {
    const adapter = new InMemoryOutboxAdapter();
    const clock = (() => {
      let tick = 0;
      return () => new Date(1_700_000_000_000 + tick++ * 1_000);
    })();
    const provider = new OutboxProvider(adapter, { now: clock });
    const relay = new OutboxRelay(adapter, provider, {
      now: clock
    });

    let attempts = 0;

    await provider.dispatch(
      buildBaseRequest({
        id: "handler-1",
        operation_name: "payment.charge",
        operation_type: "COMMAND",
        version_range: ">=1.0.0 <2.0.0",
        handle: async () => {
          attempts += 1;

          if (attempts === 1) {
            throw new Error("temporary");
          }

          return { ok: true };
        }
      })
    );

    const firstRun = await relay.runOnce();
    const secondRun = await relay.runOnce();

    const deliveredRecords = await adapter.list({ status: "DELIVERED" });

    expect(firstRun.retried).toBe(1);
    expect(secondRun.delivered).toBe(1);
    expect(deliveredRecords).toHaveLength(1);
    expect(attempts).toBe(2);
  });

  it("moves exhausted operation to DLQ", async () => {
    const adapter = new InMemoryOutboxAdapter();
    const clock = (() => {
      let tick = 0;
      return () => new Date(1_700_000_000_000 + tick++ * 1_000);
    })();
    const provider = new OutboxProvider(adapter, { now: clock });
    const dlq = new OutboxDLQManager();
    const relay = new OutboxRelay(adapter, provider, {
      dlq_manager: dlq,
      now: clock
    });

    await provider.dispatch(
      buildBaseRequest({
        id: "handler-2",
        operation_name: "payment.charge",
        operation_type: "COMMAND",
        version_range: ">=1.0.0 <2.0.0",
        handle: async () => {
          throw new Error("fatal");
        }
      })
    );

    await relay.runOnce();
    await relay.runOnce();

    const failed = await adapter.list({ status: "FAILED" });
    const dlqEntries = await dlq.list();

    expect(failed).toHaveLength(1);
    expect(dlqEntries).toHaveLength(1);
    expect(dlqEntries[0]?.attempts).toBe(2);
  });
});
