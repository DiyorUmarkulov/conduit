import { isEnvelopeExpired } from "../../envelope/envelope-validator.js";
import { ValidationError } from "../../types/errors.js";
import type { DispatchMiddleware } from "../middleware-pipeline.js";

export interface TtlCheckMiddlewareOptions {
  now?: () => Date;
}

export const createTtlCheckMiddleware = (
  options: TtlCheckMiddlewareOptions = {}
): DispatchMiddleware => {
  const now = options.now ?? (() => new Date());

  return async (context, next) => {
    if (isEnvelopeExpired(context.envelope, now())) {
      throw new ValidationError("Envelope has expired", [
        "expires_at is in the past"
      ]);
    }

    await next();
  };
};
