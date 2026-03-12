import { createHash } from "node:crypto";

import type { ProviderDispatchRequest } from "@conduit/core";
import { matchOperationPattern, patternSpecificity } from "@conduit/core";

export interface PartitionKeyRule {
  pattern: string;
  candidate_fields: string[];
}

export interface KeyPartitionerOptions {
  rules?: PartitionKeyRule[];
  default_fields?: string[];
  max_length?: number;
  fallback_to_operation_id?: boolean;
}

const DEFAULT_FIELDS = [
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

const readFromPayload = (payload: unknown, fields: string[]): string | undefined => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
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

const selectRule = (
  rules: PartitionKeyRule[] | undefined,
  operationName: string
): PartitionKeyRule | undefined => {
  if (!rules || rules.length === 0) {
    return undefined;
  }

  let selected: PartitionKeyRule | undefined;
  let bestSpecificity = -1;

  for (const rule of rules) {
    if (!matchOperationPattern(rule.pattern, operationName)) {
      continue;
    }

    const specificity = patternSpecificity(rule.pattern);

    if (specificity > bestSpecificity) {
      bestSpecificity = specificity;
      selected = rule;
    }
  }

  return selected;
};

export const createKeyPartitioner = (
  options: KeyPartitionerOptions = {}
): ((request: ProviderDispatchRequest) => string | undefined) => {
  const rules = options.rules ?? [];
  const defaultFields = options.default_fields ?? [...DEFAULT_FIELDS];
  const maxLength = Math.max(16, options.max_length ?? 255);
  const fallbackToOperationId = options.fallback_to_operation_id ?? false;

  return (request) => {
    const rule = selectRule(rules, request.envelope.operation_name);
    const fields = rule?.candidate_fields ?? defaultFields;

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
