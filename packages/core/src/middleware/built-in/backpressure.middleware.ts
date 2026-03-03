import { BackpressureError } from "../../types/errors.js";
import type { DispatchMiddleware } from "../middleware-pipeline.js";

export interface BackpressureMiddlewareOptions {
  sleep?: (delay_ms: number) => Promise<void>;
}

const sleep = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

export const createBackpressureMiddleware = (
  options: BackpressureMiddlewareOptions = {}
): DispatchMiddleware => {
  const sleepFn = options.sleep ?? sleep;

  return async (context, next) => {
    const policy = context.route.backpressure;
    const getBacklogSize = context.provider.getBacklogSize;

    if (!policy || !getBacklogSize) {
      await next();
      return;
    }

    const deadline = Date.now() + policy.block_timeout_ms;

    while (Date.now() <= deadline) {
      const backlog = await getBacklogSize(context.route);

      if (backlog <= policy.outbox_watermark) {
        await next();
        return;
      }

      await sleepFn(25);
    }

    switch (policy.on_overflow) {
      case "DROP":
        return;
      case "SAMPLE": {
        const sampleRate = policy.sample_rate ?? 0.1;

        if (Math.random() <= sampleRate) {
          await next();
        }

        return;
      }
      case "RAISE_EXCEPTION":
      default:
        throw new BackpressureError(
          `Backpressure triggered for ${context.envelope.operation_name} (${context.provider_name})`
        );
    }
  };
};
