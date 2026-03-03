import type { OperationEnvelope, RouteConfig } from "@conduit/core";

import type { OutboxRecord, OutboxRecordStatus } from "../outbox-record.js";

export interface SqlOutboxRow {
  id: unknown;
  operation_id: unknown;
  route: unknown;
  envelope: unknown;
  handler_id: unknown;
  status: unknown;
  attempt_number: unknown;
  next_attempt_at: unknown;
  created_at: unknown;
  updated_at: unknown;
  partition_key: unknown;
  last_error: unknown;
  delivered_at: unknown;
}

const OUTBOX_RECORD_STATUS_SET = new Set<OutboxRecordStatus>([
  "PENDING",
  "PROCESSING",
  "DELIVERED",
  "FAILED"
]);

const asString = (value: unknown, field: string): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`Invalid ${field}: expected string, got ${typeof value}`);
};

const asOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
};

const asNumber = (value: unknown, field: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Invalid ${field}: expected finite number`);
};

const asStatus = (value: unknown): OutboxRecordStatus => {
  const status = asString(value, "status") as OutboxRecordStatus;

  if (!OUTBOX_RECORD_STATUS_SET.has(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  return status;
};

const parseJson = <T>(value: unknown, field: string): T => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new Error(
        `Invalid ${field}: failed to parse JSON (${String(error)})`
      );
    }
  }

  if (typeof value === "object" && value !== null) {
    return value as T;
  }

  throw new Error(`Invalid ${field}: expected JSON object or string`);
};

export const mapSqlRowToOutboxRecord = (row: SqlOutboxRow): OutboxRecord => {
  const record: OutboxRecord = {
    id: asString(row.id, "id"),
    operation_id: asString(row.operation_id, "operation_id"),
    route: parseJson<RouteConfig>(row.route, "route"),
    envelope: parseJson<OperationEnvelope>(row.envelope, "envelope"),
    handler_id: asString(row.handler_id, "handler_id"),
    status: asStatus(row.status),
    attempt_number: asNumber(row.attempt_number, "attempt_number"),
    next_attempt_at: asString(row.next_attempt_at, "next_attempt_at"),
    created_at: asString(row.created_at, "created_at"),
    updated_at: asString(row.updated_at, "updated_at")
  };

  const partitionKey = asOptionalString(row.partition_key);

  if (partitionKey !== undefined) {
    record.partition_key = partitionKey;
  }

  const lastError = asOptionalString(row.last_error);

  if (lastError !== undefined) {
    record.last_error = lastError;
  }

  const deliveredAt = asOptionalString(row.delivered_at);

  if (deliveredAt !== undefined) {
    record.delivered_at = deliveredAt;
  }

  return record;
};
