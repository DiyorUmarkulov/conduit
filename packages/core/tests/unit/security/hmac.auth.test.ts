import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { EnvelopeBuilder } from "../../../src/envelope/envelope-builder.js";
import { HmacAuthMechanism } from "../../../src/security/mechanisms/hmac.auth.js";
import { AuthorizationError } from "../../../src/types/errors.js";

const sign = (secret: string, value: string): string =>
  createHmac("sha256", secret).update(value).digest("hex");

describe("HmacAuthMechanism", () => {
  it("authenticates valid signed envelope", () => {
    const mechanism = new HmacAuthMechanism({
      secret: "super-secret"
    });

    const envelope = EnvelopeBuilder.command("order.create", { order_id: "o-1" })
      .withSourceService("api-gateway")
      .withIdempotencyKey("idem-1")
      .build();

    const signature = sign(
      "super-secret",
      JSON.stringify({
        operation_id: envelope.operation_id,
        operation_name: envelope.operation_name,
        operation_type: envelope.operation_type,
        schema_version: envelope.schema_version,
        payload: envelope.payload,
        created_at: envelope.created_at
      })
    );

    envelope.metadata.headers = {
      "x-conduit-signature": signature
    };

    const context = mechanism.authenticate(envelope);

    expect(context.authenticated).toBe(true);
    expect(context.principal.id).toBe("api-gateway");
  });

  it("throws on invalid signature", () => {
    const mechanism = new HmacAuthMechanism({
      secret: "super-secret"
    });

    const envelope = EnvelopeBuilder.command("order.create", { order_id: "o-1" })
      .withSourceService("api-gateway")
      .withIdempotencyKey("idem-1")
      .withHeaders({
        "x-conduit-signature": "invalid"
      })
      .build();

    expect(() => mechanism.authenticate(envelope)).toThrowError(AuthorizationError);
  });
});
