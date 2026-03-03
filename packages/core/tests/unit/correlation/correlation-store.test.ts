import { describe, expect, it } from "vitest";

import { EnvelopeBuilder } from "../../../src/envelope/envelope-builder.js";
import {
  InMemoryCorrelationStore
} from "../../../src/correlation/correlation-store.js";
import { CorrelationTimeoutError } from "../../../src/types/errors.js";

describe("InMemoryCorrelationStore", () => {
  it("resolves pending waiter by correlation id", async () => {
    const store = new InMemoryCorrelationStore();
    const correlationId = "corr-1";

    const wait = store.waitForReply(correlationId, {
      timeout_ms: 1_000
    });

    const reply = EnvelopeBuilder.event("order.reply", { ok: true })
      .withSourceService("orders")
      .withCorrelationId(correlationId)
      .build();

    expect(store.resolve(reply)).toBe(true);
    await expect(wait).resolves.toEqual(reply);
    expect(store.pending()).toBe(0);
  });

  it("times out when reply is not delivered", async () => {
    const store = new InMemoryCorrelationStore();

    await expect(
      store.waitForReply("corr-timeout", {
        timeout_ms: 5
      })
    ).rejects.toBeInstanceOf(CorrelationTimeoutError);
  });
});
