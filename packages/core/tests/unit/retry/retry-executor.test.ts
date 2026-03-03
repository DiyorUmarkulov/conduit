import { describe, expect, it } from "vitest";

import { RetryExecutor } from "../../../src/retry/retry-executor.js";
import { ExponentialRetryStrategy } from "../../../src/retry/strategies/exponential.strategy.js";
import { FixedRetryStrategy } from "../../../src/retry/strategies/fixed.strategy.js";
import { ValidationError } from "../../../src/types/errors.js";

describe("RetryExecutor", () => {
  it("retries and eventually succeeds", async () => {
    const executor = new RetryExecutor(async () => Promise.resolve());

    let attempts = 0;

    const result = await executor.execute(
      async () => {
        attempts += 1;

        if (attempts < 3) {
          throw new Error("temporary");
        }

        return "ok";
      },
      {
        max_attempts: 3,
        strategy: new FixedRetryStrategy(0),
        retry_on: () => true
      }
    );

    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(3);
  });

  it("caps exponential delay with jitter", () => {
    const strategy = new ExponentialRetryStrategy({
      initial_delay_ms: 10,
      max_delay_ms: 100,
      jitter: "FULL",
      random: () => 0.5
    });

    expect(strategy.nextDelayMs(1)).toBe(5);
    expect(strategy.nextDelayMs(5)).toBe(50);
  });

  it("does not wrap non-retryable error into DeliveryExhaustedError", async () => {
    const executor = new RetryExecutor(async () => Promise.resolve());

    await expect(
      executor.execute(
        async () => {
          throw new ValidationError("invalid");
        },
        {
          max_attempts: 3,
          strategy: new FixedRetryStrategy(0),
          retry_on: () => false
        }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
