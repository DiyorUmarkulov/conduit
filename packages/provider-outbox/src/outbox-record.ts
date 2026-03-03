import type { OperationEnvelope, RouteConfig } from "@conduit/core";

export const OUTBOX_RECORD_STATUSES = [
  "PENDING",
  "PROCESSING",
  "DELIVERED",
  "FAILED"
] as const;

export type OutboxRecordStatus = (typeof OUTBOX_RECORD_STATUSES)[number];

export interface OutboxRecord {
  id: string;
  operation_id: string;
  route: RouteConfig;
  envelope: OperationEnvelope;
  handler_id: string;
  status: OutboxRecordStatus;
  attempt_number: number;
  next_attempt_at: string;
  created_at: string;
  updated_at: string;
  partition_key?: string;
  last_error?: string;
  delivered_at?: string;
}

export interface OutboxClaimOptions {
  limit: number;
  now: Date;
  partition_ordering?: "NONE" | "BY_PARTITION_KEY";
}

export interface OutboxRetryUpdate {
  attempt_number: number;
  next_attempt_at: Date;
  last_error: string;
}

export interface OutboxRecordFilter {
  status?: OutboxRecordStatus;
  operation_name?: string;
}
