import type { Priority } from "./priority.js";

export interface OperationMetadata {
  trace_id: string;
  source_service: string;
  correlation_id?: string;
  causation_id?: string;
  idempotency_key?: string;
  priority?: Priority;
  attempt_number?: number;
  reply_to?: string;
  headers?: Record<string, string>;
}
