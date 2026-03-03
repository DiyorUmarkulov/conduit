import { describe, expect, it } from "vitest";

import { ACLBuilder, ACLEvaluator } from "../../../src/security/index.js";

describe("ACLEvaluator", () => {
  it("applies first-match semantics", () => {
    const builder = new ACLBuilder();

    builder
      .add(builder.allow("api-gateway").to("order.*", "COMMAND"))
      .add(builder.deny("api-gateway").to("order.create", "COMMAND"))
      .denyAll();

    const evaluator = new ACLEvaluator(builder.build());

    const decision = evaluator.evaluate({
      source_service: "api-gateway",
      operation_name: "order.create",
      operation_type: "COMMAND"
    });

    expect(decision.allowed).toBe(true);
    expect(decision.matched_rule?.effect).toBe("ALLOW");
  });

  it("denies by default when no rule matches", () => {
    const evaluator = new ACLEvaluator([
      {
        effect: "ALLOW",
        source_service: "order-service",
        operation_name: "payment.charge",
        operation_type: "COMMAND"
      }
    ]);

    const decision = evaluator.evaluate({
      source_service: "api-gateway",
      operation_name: "order.create",
      operation_type: "COMMAND"
    });

    expect(decision.allowed).toBe(false);
  });

  it("supports wildcard service and operation", () => {
    const evaluator = new ACLEvaluator([
      {
        effect: "ALLOW",
        source_service: "*",
        operation_name: "*.created",
        operation_type: "EVENT"
      },
      {
        effect: "DENY",
        source_service: "*",
        operation_name: "*",
        operation_type: "ALL"
      }
    ]);

    const allowed = evaluator.evaluate({
      source_service: "billing",
      operation_name: "order.created",
      operation_type: "EVENT"
    });

    const denied = evaluator.evaluate({
      source_service: "billing",
      operation_name: "order.create",
      operation_type: "COMMAND"
    });

    expect(allowed.allowed).toBe(true);
    expect(denied.allowed).toBe(false);
  });
});
