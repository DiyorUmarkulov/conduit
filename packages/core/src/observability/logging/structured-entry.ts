import type { ConduitLifecycleEvent } from "./lifecycle-events.js";

export interface StructuredLogEntry {
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  event: ConduitLifecycleEvent;
  message: string;
  operation_id: string;
  operation_name: string;
  operation_type: string;
  handler_id: string;
  provider: string;
  source_service: string;
  trace_id: string;
  correlation_id?: string;
  attempt_number?: number;
  duration_ms?: number;
  error?: string;
}
