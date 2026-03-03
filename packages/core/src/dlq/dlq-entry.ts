import type { OperationEnvelope } from "../types/envelope.js";
import type { RouteConfig } from "../types/route.js";

export interface DLQAttemptRecord {
  attempt_number: number;
  failed_at: string;
  error: string;
}

export interface DLQEntry {
  id: string;
  envelope: OperationEnvelope;
  route: RouteConfig;
  handler_id: string;
  attempts: number;
  last_error: string;
  created_at: string;
  attempt_history: DLQAttemptRecord[];
}
