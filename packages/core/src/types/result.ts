export type DispatchStatus = "DELIVERED" | "QUEUED" | "DLQ" | "DROPPED";

export type HandlerStatus = "DELIVERED" | "QUEUED" | "DLQ" | "DROPPED" | "FAILED";

export interface HandlerDispatchResult {
  handler_id: string;
  status: HandlerStatus;
  attempts: number;
  error?: string;
}

export interface DispatchResult {
  operation_id: string;
  status: DispatchStatus;
  provider: string;
  handler_results: HandlerDispatchResult[];
  dropped_reason?: string;
}
