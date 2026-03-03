import type { OperationMetadata } from "./metadata.js";
import type { OperationName, OperationType } from "./operation.js";

export interface OperationEnvelope<TPayload = unknown> {
  operation_id: string;
  operation_type: OperationType;
  operation_name: OperationName;
  schema_version: string;
  payload: TPayload;
  metadata: OperationMetadata;
  created_at: string;
  expires_at?: string;
}
