import type { OperationEnvelope } from "../types/envelope.js";
import { AuthorizationError } from "../types/errors.js";
import type { ACLEvaluator } from "../security/acl/acl-evaluator.js";

export class AuthorizationGuard {
  public constructor(private readonly evaluator: ACLEvaluator) {}

  public assertAllowed(envelope: OperationEnvelope): void {
    const decision = this.evaluator.evaluate({
      source_service: envelope.metadata.source_service,
      operation_name: envelope.operation_name,
      operation_type: envelope.operation_type
    });

    if (!decision.allowed) {
      throw new AuthorizationError(
        `Access denied for ${envelope.metadata.source_service} -> ${envelope.operation_name}`
      );
    }
  }
}
