import type { OperationType } from "../../types/operation.js";

import type { ACLEffect, ACLRule } from "./acl-rule.js";

interface ACLRuleDraft {
  effect: ACLEffect;
  source_service: string;
  operation_name: string;
  operation_type?: OperationType | "ALL";
}

class ACLRuleBuilder {
  private readonly draft: ACLRuleDraft;

  public constructor(effect: ACLEffect, sourceService: string) {
    this.draft = {
      effect,
      source_service: sourceService,
      operation_name: "*",
      operation_type: "ALL"
    };
  }

  public to(
    operationName: string,
    operationType: OperationType | "ALL" = "ALL"
  ): this {
    this.draft.operation_name = operationName;
    this.draft.operation_type = operationType;
    return this;
  }

  public build(): ACLRule {
    const rule: ACLRule = {
      effect: this.draft.effect,
      source_service: this.draft.source_service,
      operation_name: this.draft.operation_name
    };

    if (this.draft.operation_type !== undefined) {
      rule.operation_type = this.draft.operation_type;
    }

    return rule;
  }
}

export class ACLBuilder {
  private readonly rules: ACLRule[] = [];

  public allow(sourceService: string): ACLRuleBuilder {
    return new ACLRuleBuilder("ALLOW", sourceService);
  }

  public deny(sourceService: string): ACLRuleBuilder {
    return new ACLRuleBuilder("DENY", sourceService);
  }

  public add(rule: ACLRule | ACLRuleBuilder): this {
    this.rules.push(rule instanceof ACLRuleBuilder ? rule.build() : rule);
    return this;
  }

  public denyAll(): this {
    this.rules.push({
      effect: "DENY",
      source_service: "*",
      operation_name: "*",
      operation_type: "ALL"
    });
    return this;
  }

  public build(): ACLRule[] {
    return [...this.rules];
  }
}
