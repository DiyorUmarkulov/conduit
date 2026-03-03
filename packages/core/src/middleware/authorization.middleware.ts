import { AuthorizationError } from "../types/errors.js";
import type { DispatchMiddleware } from "./middleware-pipeline.js";
import { type ACLEvaluator } from "../security/acl/acl-evaluator.js";

export interface AuthorizationMiddlewareOptions {
  evaluator: ACLEvaluator;
}

export const createAuthorizationMiddleware = (
  options: AuthorizationMiddlewareOptions
): DispatchMiddleware => {
  return async (context, next) => {
    const decision = options.evaluator.evaluate({
      source_service: context.envelope.metadata.source_service,
      operation_name: context.envelope.operation_name,
      operation_type: context.envelope.operation_type
    });

    if (!decision.allowed) {
      throw new AuthorizationError(
        `Access denied for ${context.envelope.metadata.source_service} -> ${context.envelope.operation_name}`
      );
    }

    await next();
  };
};
