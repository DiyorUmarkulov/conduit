import { createHash } from "node:crypto";

import type { ProviderDispatchRequest } from "@conduit/core";

export interface PayloadPartitionKeyResolverOptions {
  candidate_fields?: string[];
  max_length?: number;
  fallback_to_operation_id?: boolean;
}

const DEFAULT_CANDIDATE_FIELDS = [
  "partition_key",
  "aggregate_id",
  "order_id",
  "entity_id",
  "id"
] as const;

const normalizeKey = (value: string, maxLength: number): string => {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return createHash("sha1").update(trimmed).digest("hex");
};

const readFromPayload = (
  payload: unknown,
  fields: string[]
): string | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const source = payload as Record<string, unknown>;

  for (const field of fields) {
    const value = source[field];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
  }

  return undefined;
};

export const createPayloadPartitionKeyResolver = (
  options: PayloadPartitionKeyResolverOptions = {}
): ((request: ProviderDispatchRequest) => string | undefined) => {
  const fields = [...(options.candidate_fields ?? DEFAULT_CANDIDATE_FIELDS)];
  const maxLength = Math.max(16, options.max_length ?? 255);
  const fallbackToOperationId = options.fallback_to_operation_id ?? false;

  return (request) => {
    const payloadValue = readFromPayload(request.envelope.payload, fields);

    if (payloadValue) {
      return normalizeKey(payloadValue, maxLength);
    }

    if (request.envelope.metadata.idempotency_key) {
      return normalizeKey(request.envelope.metadata.idempotency_key, maxLength);
    }

    if (request.envelope.metadata.correlation_id) {
      return normalizeKey(request.envelope.metadata.correlation_id, maxLength);
    }

    if (fallbackToOperationId) {
      return normalizeKey(request.envelope.operation_id, maxLength);
    }

    return undefined;
  };
};
