import { describe, expect, it } from "vitest";

import { commandBuilder, eventBuilder } from "../../src/index.js";

describe("builders", () => {
  it("creates command envelope with overrides", () => {
    const envelope = commandBuilder("order.create", { order_id: "o-1" })
      .withSourceService("api")
      .withIdempotencyKey("idem-1")
      .build();

    expect(envelope.operation_name).toBe("order.create");
    expect(envelope.metadata.source_service).toBe("api");
    expect(envelope.metadata.idempotency_key).toBe("idem-1");
  });

  it("creates event envelope", () => {
    const envelope = eventBuilder("order.created", { order_id: "o-1" })
      .withSourceService("orders")
      .build();

    expect(envelope.operation_type).toBe("EVENT");
    expect(envelope.operation_name).toBe("order.created");
  });
});
