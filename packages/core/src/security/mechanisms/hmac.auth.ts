import { createHmac, timingSafeEqual } from "node:crypto";

import { AuthorizationError } from "../../types/errors.js";
import type { OperationEnvelope } from "../../types/envelope.js";
import type { AuthContext, IAuthMechanism } from "../auth-context.js";

export interface HmacAuthMechanismOptions {
  secret?: string;
  secret_resolver?: (sourceService: string) => string | undefined;
  algorithm?: "sha256" | "sha512";
  header_name?: string;
  message_builder?: (envelope: OperationEnvelope) => string;
}

const toHexDigest = (value: string): string => value.trim().toLowerCase();

const defaultMessageBuilder = (envelope: OperationEnvelope): string =>
  JSON.stringify({
    operation_id: envelope.operation_id,
    operation_name: envelope.operation_name,
    operation_type: envelope.operation_type,
    schema_version: envelope.schema_version,
    payload: envelope.payload,
    created_at: envelope.created_at
  });

export class HmacAuthMechanism implements IAuthMechanism {
  public readonly name = "HMAC";

  private readonly algorithm: "sha256" | "sha512";
  private readonly headerName: string;
  private readonly messageBuilder: (envelope: OperationEnvelope) => string;

  public constructor(private readonly options: HmacAuthMechanismOptions = {}) {
    this.algorithm = options.algorithm ?? "sha256";
    this.headerName = (options.header_name ?? "x-conduit-signature").toLowerCase();
    this.messageBuilder = options.message_builder ?? defaultMessageBuilder;
  }

  public authenticate(envelope: OperationEnvelope): AuthContext {
    const signature = this.resolveHeader(envelope, this.headerName);

    if (!signature) {
      throw new AuthorizationError(`Missing signature header: ${this.headerName}`);
    }

    const secret = this.resolveSecret(envelope.metadata.source_service);

    if (!secret) {
      throw new AuthorizationError("No HMAC secret available for source service");
    }

    const message = this.messageBuilder(envelope);
    const digest = createHmac(this.algorithm, secret).update(message).digest("hex");

    const actual = Buffer.from(toHexDigest(signature), "utf8");
    const expected = Buffer.from(toHexDigest(digest), "utf8");

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new AuthorizationError("Invalid HMAC signature");
    }

    return {
      authenticated: true,
      mechanism: this.name,
      principal: {
        id: envelope.metadata.source_service,
        service: envelope.metadata.source_service
      }
    };
  }

  private resolveSecret(sourceService: string): string | undefined {
    if (this.options.secret_resolver) {
      return this.options.secret_resolver(sourceService);
    }

    return this.options.secret;
  }

  private resolveHeader(
    envelope: OperationEnvelope,
    headerName: string
  ): string | undefined {
    const headers = envelope.metadata.headers;

    if (!headers) {
      return undefined;
    }

    const direct = headers[headerName];

    if (direct) {
      return direct;
    }

    const lowered = headerName.toLowerCase();

    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowered) {
        return value;
      }
    }

    return undefined;
  }
}
