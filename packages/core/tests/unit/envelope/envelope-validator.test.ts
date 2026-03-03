import { describe, expect, it } from "vitest";

import { EnvelopeBuilder } from "../../../src/envelope/envelope-builder.js";
import { validateEnvelope } from "../../../src/envelope/envelope-validator.js";
import { ValidationError } from "../../../src/types/errors.js";

describe("validateEnvelope", () => {
  it("rejects COMMAND without idempotency_key", () => {
    expect(() =>
      EnvelopeBuilder.command("order.create", { order_id: "o-1" })
        .withSourceService("api-gateway")
        .build()
    ).toThrowError(ValidationError);
  });

  it("rejects non-v7 operation_id", () => {
    const validEnvelope = EnvelopeBuilder.event("inventory.updated", { sku: "A-1" })
      .withSourceService("warehouse")
      .build();

    const invalidEnvelope = {
      ...validEnvelope,
      operation_id: "123e4567-e89b-42d3-a456-426614174000"
    };

    expect(() => validateEnvelope(invalidEnvelope)).toThrowError(ValidationError);
  });
});
