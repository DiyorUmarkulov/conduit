import { randomBytes } from "node:crypto";

import type { OperationEnvelope } from "../types/envelope.js";
import type { OperationMetadata } from "../types/metadata.js";
import { asOperationName, type OperationType } from "../types/operation.js";
import { validateEnvelope } from "./envelope-validator.js";

const DEFAULT_PRIORITY = "NORMAL" as const;

const formatUuid = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const setByte = (bytes: Uint8Array, index: number, value: number): void => {
  bytes[index] = value;
};

const getByte = (bytes: Uint8Array, index: number): number => bytes[index] ?? 0;

export const createUuidV7 = (now = Date.now()): string => {
  const bytes = randomBytes(16);
  const timestamp = BigInt(now);

  setByte(bytes, 0, Number((timestamp >> 40n) & 0xffn));
  setByte(bytes, 1, Number((timestamp >> 32n) & 0xffn));
  setByte(bytes, 2, Number((timestamp >> 24n) & 0xffn));
  setByte(bytes, 3, Number((timestamp >> 16n) & 0xffn));
  setByte(bytes, 4, Number((timestamp >> 8n) & 0xffn));
  setByte(bytes, 5, Number(timestamp & 0xffn));

  setByte(bytes, 6, (getByte(bytes, 6) & 0x0f) | 0x70);
  setByte(bytes, 8, (getByte(bytes, 8) & 0x3f) | 0x80);

  return formatUuid(bytes);
};

interface EnvelopeBuilderState<TPayload> {
  operation_id: string;
  operation_type: OperationType;
  operation_name: string;
  schema_version: string;
  payload: TPayload;
  metadata: OperationMetadata;
  created_at: string;
  expires_at?: string;
}

export class EnvelopeBuilder<TPayload> {
  private readonly state: EnvelopeBuilderState<TPayload>;

  public constructor(operationType: OperationType, operationName: string, payload: TPayload) {
    this.state = {
      operation_id: createUuidV7(),
      operation_type: operationType,
      operation_name: operationName,
      schema_version: "1.0.0",
      payload,
      metadata: {
        trace_id: createUuidV7(),
        source_service: "unknown",
        priority: DEFAULT_PRIORITY
      },
      created_at: new Date().toISOString()
    };
  }

  public static command<TPayload>(
    operationName: string,
    payload: TPayload
  ): EnvelopeBuilder<TPayload> {
    return new EnvelopeBuilder("COMMAND", operationName, payload);
  }

  public static event<TPayload>(
    operationName: string,
    payload: TPayload
  ): EnvelopeBuilder<TPayload> {
    return new EnvelopeBuilder("EVENT", operationName, payload);
  }

  public withOperationId(operationId: string): this {
    this.state.operation_id = operationId;
    return this;
  }

  public withSchemaVersion(schemaVersion: string): this {
    this.state.schema_version = schemaVersion;
    return this;
  }

  public withSourceService(sourceService: string): this {
    this.state.metadata.source_service = sourceService;
    return this;
  }

  public withTraceId(traceId: string): this {
    this.state.metadata.trace_id = traceId;
    return this;
  }

  public withCorrelationId(correlationId: string): this {
    this.state.metadata.correlation_id = correlationId;
    return this;
  }

  public withCausationId(causationId: string): this {
    this.state.metadata.causation_id = causationId;
    return this;
  }

  public withIdempotencyKey(idempotencyKey: string): this {
    this.state.metadata.idempotency_key = idempotencyKey;
    return this;
  }

  public withReplyTo(replyTo: string): this {
    this.state.metadata.reply_to = replyTo;
    return this;
  }

  public withHeaders(headers: Record<string, string>): this {
    this.state.metadata.headers = { ...(this.state.metadata.headers ?? {}), ...headers };
    return this;
  }

  public withCreatedAt(createdAt: string): this {
    this.state.created_at = createdAt;
    return this;
  }

  public withExpiresAt(expiresAt: string): this {
    this.state.expires_at = expiresAt;
    return this;
  }

  public build(): OperationEnvelope<TPayload> {
    const envelope: OperationEnvelope<TPayload> = {
      operation_id: this.state.operation_id,
      operation_type: this.state.operation_type,
      operation_name: asOperationName(this.state.operation_name),
      schema_version: this.state.schema_version,
      payload: this.state.payload,
      metadata: { ...this.state.metadata },
      created_at: this.state.created_at
    };

    if (this.state.expires_at) {
      envelope.expires_at = this.state.expires_at;
    }

    validateEnvelope(envelope);

    return envelope;
  }
}
