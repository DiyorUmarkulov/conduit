import { describe, expect, it } from "vitest";

import { EnvelopeBuilder } from "../../../src/envelope/envelope-builder.js";

describe("EnvelopeBuilder", () => {
  it("builds COMMAND envelope with required metadata", () => {
    const envelope = EnvelopeBuilder.command("order.create", { order_id: "o-1" })
      .withSourceService("api-gateway")
      .withIdempotencyKey("idem-1")
      .build();

    expect(envelope.operation_type).toBe("COMMAND");
    expect(envelope.operation_name).toBe("order.create");
    expect(envelope.metadata.idempotency_key).toBe("idem-1");
    expect(envelope.operation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
