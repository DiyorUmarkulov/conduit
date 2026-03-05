import {
  ACL_EFFECT,
  ACL_OPERATION_TYPE,
  type ACLEffect,
  type ACLOperationType,
  type ACLRule
} from "./acl-rule.js";

interface ACLRuleDraft {
  effect: ACLEffect;
  source_service: string;
  operation_name: string;
  operation_type?: ACLOperationType;
}

class ACLRuleBuilder {
  private readonly draft: ACLRuleDraft;

  public constructor(effect: ACLEffect, sourceService: string) {
    this.draft = {
      effect,
      source_service: sourceService,
      operation_name: "*",
      operation_type: ACL_OPERATION_TYPE.ALL
    };
  }

  public to(
    operationName: string,
    operationType: ACLOperationType = ACL_OPERATION_TYPE.ALL
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
    return new ACLRuleBuilder(ACL_EFFECT.ALLOW, sourceService);
  }

  public deny(sourceService: string): ACLRuleBuilder {
    return new ACLRuleBuilder(ACL_EFFECT.DENY, sourceService);
  }

  public add(rule: ACLRule | ACLRuleBuilder): this {
    this.rules.push(rule instanceof ACLRuleBuilder ? rule.build() : rule);
    return this;
  }

  public denyAll(): this {
    this.rules.push({
      effect: ACL_EFFECT.DENY,
      source_service: "*",
      operation_name: "*",
      operation_type: ACL_OPERATION_TYPE.ALL
    });
    return this;
  }

  public build(): ACLRule[] {
    return [...this.rules];
  }
}
