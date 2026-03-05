import type { OperationType } from "../../types/operation.js";

type ValueOf<T extends Record<string, string>> = T[keyof T];

export const ACL_EFFECT = {
  ALLOW: "ALLOW",
  DENY: "DENY"
} as const;

export type ACLEffect = ValueOf<typeof ACL_EFFECT>;

export const ACL_OPERATION_TYPE = {
  ALL: "ALL",
  COMMAND: "COMMAND",
  EVENT: "EVENT"
} as const;

export type ACLOperationType = ValueOf<typeof ACL_OPERATION_TYPE>;

export interface ACLRule {
  effect: ACLEffect;
  source_service: string;
  operation_name: string;
  operation_type?: ACLOperationType;
}

export interface ACLContext {
  source_service: string;
  operation_name: string;
  operation_type: OperationType;
}
