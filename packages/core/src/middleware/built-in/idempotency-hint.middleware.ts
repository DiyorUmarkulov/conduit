import { ValidationError } from "../../types/errors.js";
import type { DispatchMiddleware } from "../middleware-pipeline.js";

export interface IdempotencyHintMiddlewareOptions {
  required_for_events?: boolean;
}

export const createIdempotencyHintMiddleware = (
  options: IdempotencyHintMiddlewareOptions = {}
): DispatchMiddleware => {
  const requiredForEvents = options.required_for_events ?? false;

  return async (context, next) => {
    const isRequired =
      context.envelope.operation_type === "COMMAND" || requiredForEvents;

    if (isRequired && !context.envelope.metadata.idempotency_key) {
      throw new ValidationError("Idempotency key is required", [
        "metadata.idempotency_key is required"
      ]);
    }

    await next();
  };
};
