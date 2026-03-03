import type { OperationType } from "../../types/operation.js";

export type ACLEffect = "ALLOW" | "DENY";

export interface ACLRule {
  effect: ACLEffect;
  source_service: string;
  operation_name: string;
  operation_type?: OperationType | "ALL";
}

export interface ACLContext {
  source_service: string;
  operation_name: string;
  operation_type: OperationType;
}
