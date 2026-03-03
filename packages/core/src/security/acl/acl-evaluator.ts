import { matchOperationPattern } from "../../router/route-matcher.js";

import type { ACLContext, ACLRule } from "./acl-rule.js";

const matchesPattern = (pattern: string, value: string): boolean => {
  if (pattern === "*") {
    return true;
  }

  return matchOperationPattern(pattern, value);
};

const matchesSourceService = (pattern: string, serviceName: string): boolean => {
  if (pattern === "*") {
    return true;
  }

  return pattern === serviceName;
};

const matchesOperationType = (
  ruleType: ACLRule["operation_type"],
  operationType: ACLContext["operation_type"]
): boolean => {
  if (!ruleType || ruleType === "ALL") {
    return true;
  }

  return ruleType === operationType;
};

export interface ACLDecision {
  allowed: boolean;
  matched_rule?: ACLRule;
}

export class ACLEvaluator {
  public constructor(private readonly rules: ACLRule[]) {}

  public evaluate(context: ACLContext): ACLDecision {
    for (const rule of this.rules) {
      if (!matchesSourceService(rule.source_service, context.source_service)) {
        continue;
      }

      if (!matchesPattern(rule.operation_name, context.operation_name)) {
        continue;
      }

      if (!matchesOperationType(rule.operation_type, context.operation_type)) {
        continue;
      }

      return {
        allowed: rule.effect === "ALLOW",
        matched_rule: rule
      };
    }

    return {
      allowed: false
    };
  }
}
