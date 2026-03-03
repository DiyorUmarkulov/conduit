import { createHmac, createPublicKey, createVerify, timingSafeEqual, type KeyObject } from "node:crypto";

import { AuthorizationError } from "../../types/errors.js";
import type { OperationEnvelope } from "../../types/envelope.js";
import type { AuthContext, IAuthMechanism } from "../auth-context.js";

interface JwtHeader {
  alg: "HS256" | "RS256" | "ES256";
  typ?: "JWT";
  kid?: string;
}

interface JwtPayload {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  roles?: string[];
  [key: string]: unknown;
}

export interface JwtAuthMechanismOptions {
  header_name?: string;
  issuer?: string;
  audience?: string;
  now?: () => Date;
  secret?: string;
  public_keys?: Record<string, string | KeyObject>;
}

const base64UrlDecode = (value: string): Buffer => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(normalized + padding, "base64");
};

const parseJson = <T>(value: Buffer, label: string): T => {
  try {
    return JSON.parse(value.toString("utf8")) as T;
  } catch {
    throw new AuthorizationError(`Invalid ${label} in JWT`);
  }
};

const verifyHmac = (input: string, signature: string, secret: string): boolean => {
  const digest = createHmac("sha256", secret).update(input).digest();
  const given = base64UrlDecode(signature);

  return digest.length === given.length && timingSafeEqual(digest, given);
};

const verifyAsymmetric = (
  algorithm: "RS256" | "ES256",
  input: string,
  signature: string,
  key: string | KeyObject
): boolean => {
  const verifier = createVerify("SHA256");

  if (algorithm === "ES256") {
    verifier.write(input);
    verifier.end();
    return verifier.verify(
      {
        key: typeof key === "string" ? createPublicKey(key) : key,
        dsaEncoding: "ieee-p1363"
      },
      base64UrlDecode(signature)
    );
  }

  verifier.write(input);
  verifier.end();
  return verifier.verify(
    typeof key === "string" ? createPublicKey(key) : key,
    base64UrlDecode(signature)
  );
};

const includesAudience = (expected: string, value: string | string[] | undefined): boolean => {
  if (!value) {
    return false;
  }

  if (typeof value === "string") {
    return value === expected;
  }

  return value.includes(expected);
};

export class JwtAuthMechanism implements IAuthMechanism {
  public readonly name = "JWT";

  private readonly headerName: string;
  private readonly now: () => Date;

  public constructor(private readonly options: JwtAuthMechanismOptions = {}) {
    this.headerName = (options.header_name ?? "authorization").toLowerCase();
    this.now = options.now ?? (() => new Date());
  }

  public authenticate(envelope: OperationEnvelope): AuthContext {
    const rawHeader =
      envelope.metadata.headers?.[this.headerName] ??
      envelope.metadata.headers?.[this.headerName.toUpperCase()];

    if (!rawHeader) {
      throw new AuthorizationError(`Missing JWT header: ${this.headerName}`);
    }

    const token = this.extractToken(rawHeader);
    const sections = token.split(".");

    if (sections.length !== 3) {
      throw new AuthorizationError("JWT must have 3 sections");
    }

    const [headerRaw, payloadRaw, signatureRaw] = sections;

    if (!headerRaw || !payloadRaw || !signatureRaw) {
      throw new AuthorizationError("JWT is malformed");
    }

    const header = parseJson<JwtHeader>(base64UrlDecode(headerRaw), "header");
    const payload = parseJson<JwtPayload>(base64UrlDecode(payloadRaw), "payload");
    const signingInput = `${headerRaw}.${payloadRaw}`;

    this.verifySignature(header, signingInput, signatureRaw);
    this.validateClaims(payload);

    return {
      authenticated: true,
      mechanism: this.name,
      principal: {
        id: payload.sub ?? envelope.metadata.source_service,
        service: envelope.metadata.source_service,
        ...(payload.roles ? { roles: payload.roles } : {}),
        claims: payload as Record<string, unknown>
      }
    };
  }

  private extractToken(headerValue: string): string {
    const trimmed = headerValue.trim();

    if (trimmed.toLowerCase().startsWith("bearer ")) {
      return trimmed.slice(7).trim();
    }

    return trimmed;
  }

  private verifySignature(
    header: JwtHeader,
    signingInput: string,
    signature: string
  ): void {
    switch (header.alg) {
      case "HS256": {
        const secret = this.options.secret;

        if (!secret) {
          throw new AuthorizationError("HS256 JWT requires configured secret");
        }

        if (!verifyHmac(signingInput, signature, secret)) {
          throw new AuthorizationError("Invalid JWT signature");
        }

        return;
      }
      case "RS256":
      case "ES256": {
        const keys = this.options.public_keys;

        if (!keys || Object.keys(keys).length === 0) {
          throw new AuthorizationError(`${header.alg} JWT requires public key(s)`);
        }

        const selectedKey =
          (header.kid ? keys[header.kid] : undefined) ?? Object.values(keys)[0];

        if (!selectedKey) {
          throw new AuthorizationError("JWT key id is not recognized");
        }

        if (!verifyAsymmetric(header.alg, signingInput, signature, selectedKey)) {
          throw new AuthorizationError("Invalid JWT signature");
        }

        return;
      }
      default:
        throw new AuthorizationError(`Unsupported JWT alg: ${header.alg}`);
    }
  }

  private validateClaims(payload: JwtPayload): void {
    const nowSeconds = Math.floor(this.now().getTime() / 1000);

    if (payload.exp !== undefined && nowSeconds >= payload.exp) {
      throw new AuthorizationError("JWT has expired");
    }

    if (payload.nbf !== undefined && nowSeconds < payload.nbf) {
      throw new AuthorizationError("JWT is not active yet");
    }

    if (this.options.issuer && payload.iss !== this.options.issuer) {
      throw new AuthorizationError("JWT issuer mismatch");
    }

    if (this.options.audience && !includesAudience(this.options.audience, payload.aud)) {
      throw new AuthorizationError("JWT audience mismatch");
    }
  }
}
