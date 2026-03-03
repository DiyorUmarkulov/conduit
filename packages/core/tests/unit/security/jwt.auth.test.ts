import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { EnvelopeBuilder } from "../../../src/envelope/envelope-builder.js";
import { JwtAuthMechanism } from "../../../src/security/mechanisms/jwt.auth.js";
import { AuthorizationError } from "../../../src/types/errors.js";

const toBase64Url = (value: string): string =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");

const signHs256 = (
  payload: Record<string, unknown>,
  secret: string
): string => {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64")
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");

  return `${signingInput}.${signature}`;
};

describe("JwtAuthMechanism", () => {
  it("authenticates HS256 token with claim validation", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const mechanism = new JwtAuthMechanism({
      secret: "jwt-secret",
      issuer: "conduit-tests",
      audience: "conduit-clients",
      now: () => now
    });

    const token = signHs256(
      {
        sub: "user-1",
        iss: "conduit-tests",
        aud: "conduit-clients",
        exp: Math.floor(now.getTime() / 1000) + 120,
        roles: ["writer"]
      },
      "jwt-secret"
    );

    const envelope = EnvelopeBuilder.command("order.create", { order_id: "o-1" })
      .withSourceService("api-gateway")
      .withIdempotencyKey("idem-1")
      .withHeaders({
        authorization: `Bearer ${token}`
      })
      .build();

    const context = mechanism.authenticate(envelope);

    expect(context.authenticated).toBe(true);
    expect(context.principal.id).toBe("user-1");
    expect(context.principal.roles).toEqual(["writer"]);
  });

  it("rejects expired token", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const mechanism = new JwtAuthMechanism({
      secret: "jwt-secret",
      now: () => now
    });

    const token = signHs256(
      {
        sub: "user-1",
        exp: Math.floor(now.getTime() / 1000) - 1
      },
      "jwt-secret"
    );

    const envelope = EnvelopeBuilder.command("order.create", { order_id: "o-1" })
      .withSourceService("api-gateway")
      .withIdempotencyKey("idem-1")
      .withHeaders({
        authorization: `Bearer ${token}`
      })
      .build();

    expect(() => mechanism.authenticate(envelope)).toThrowError(AuthorizationError);
  });
});
