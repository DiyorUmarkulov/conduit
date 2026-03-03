import { validateEnvelope } from "../../envelope/envelope-validator.js";
import type { DispatchMiddleware } from "../middleware-pipeline.js";

export const createValidationMiddleware = (): DispatchMiddleware => {
  return async (context, next) => {
    validateEnvelope(context.envelope);
    await next();
  };
};
