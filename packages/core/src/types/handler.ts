import type { OperationEnvelope } from "./envelope.js";
import type { OperationType } from "./operation.js";

export interface HandlerExecutionContext {
  attempt_number: number;
  signal?: AbortSignal;
}

export type OperationHandler<TPayload = unknown, TResult = unknown> = (
  envelope: OperationEnvelope<TPayload>,
  context: HandlerExecutionContext
) => Promise<TResult> | TResult;

export interface RegisteredHandler {
  id: string;
  operation_name: string;
  operation_type: OperationType;
  version_range: string;
  consumer_group?: string;
  handle: OperationHandler;
}
