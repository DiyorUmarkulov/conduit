import type { OperationEnvelope } from "../types/envelope.js";
import type { OperationType } from "../types/operation.js";
import { ValidationError } from "../types/errors.js";
import { parseSchemaVersion } from "../types/schema.js";

const UUID_V7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATION_NAME_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export interface EnvelopeValidationOptions {
  now?: Date;
}

const validateDateString = (value: string, fieldName: string, errors: string[]): Date | null => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${fieldName} must be a valid ISO 8601 timestamp`);
    return null;
  }

  return parsed;
};

const validateOperationType = (
  operationType: OperationType,
  errors: string[]
): void => {
  if (operationType !== "COMMAND" && operationType !== "EVENT") {
    errors.push("operation_type must be COMMAND or EVENT");
  }
};

export const validateEnvelope = (
  envelope: OperationEnvelope,
  options: EnvelopeValidationOptions = {}
): void => {
  const errors: string[] = [];

  if (!UUID_V7_RE.test(envelope.operation_id)) {
    errors.push("operation_id must be UUID v7");
  }

  validateOperationType(envelope.operation_type, errors);

  if (!OPERATION_NAME_RE.test(envelope.operation_name)) {
    errors.push(
      "operation_name must match domain.action format (lowercase, dot-separated)"
    );
  }

  if (!parseSchemaVersion(envelope.schema_version)) {
    errors.push("schema_version must be semver (major.minor.patch)");
  }

  if (envelope.payload === undefined) {
    errors.push("payload is required");
  }

  if (!envelope.metadata.trace_id) {
    errors.push("metadata.trace_id is required");
  }

  if (!envelope.metadata.source_service) {
    errors.push("metadata.source_service is required");
  }

  if (envelope.operation_type === "COMMAND" && !envelope.metadata.idempotency_key) {
    errors.push("metadata.idempotency_key is required for COMMAND");
  }

  if (
    envelope.metadata.attempt_number !== undefined &&
    (!Number.isInteger(envelope.metadata.attempt_number) ||
      envelope.metadata.attempt_number < 1)
  ) {
    errors.push("metadata.attempt_number must be an integer >= 1");
  }

  const createdAt = validateDateString(envelope.created_at, "created_at", errors);
  const expiresAt =
    envelope.expires_at !== undefined
      ? validateDateString(envelope.expires_at, "expires_at", errors)
      : null;

  if (createdAt && expiresAt && expiresAt.getTime() <= createdAt.getTime()) {
    errors.push("expires_at must be greater than created_at");
  }

  if (errors.length > 0) {
    throw new ValidationError("Envelope validation failed", errors);
  }
};

export const isEnvelopeExpired = (
  envelope: OperationEnvelope,
  now = new Date()
): boolean => {
  if (!envelope.expires_at) {
    return false;
  }

  return new Date(envelope.expires_at).getTime() <= now.getTime();
};
