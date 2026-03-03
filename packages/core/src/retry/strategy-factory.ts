import type { RetryConfig } from "../types/route.js";
import { ExponentialRetryStrategy } from "./strategies/exponential.strategy.js";
import { FixedRetryStrategy } from "./strategies/fixed.strategy.js";
import { LinearRetryStrategy } from "./strategies/linear.strategy.js";
import { toRetryPolicy, type RetryPolicy, type RetryStrategy } from "./retry-policy.js";

const cloneRetryConfig = (config: RetryConfig): RetryConfig => {
  const cloned: RetryConfig = {
    max_attempts: config.max_attempts,
    strategy: config.strategy,
    initial_delay_ms: config.initial_delay_ms
  };

  if (config.max_delay_ms !== undefined) {
    cloned.max_delay_ms = config.max_delay_ms;
  }

  if (config.jitter !== undefined) {
    cloned.jitter = config.jitter;
  }

  if (config.retry_on) {
    cloned.retry_on = config.retry_on;
  }

  return cloned;
};

export const resolveRetryConfig = (
  config: RetryConfig | undefined,
  fallback: RetryConfig
): RetryConfig => cloneRetryConfig(config ?? fallback);

export const createRetryStrategyFromConfig = (
  config: RetryConfig,
  random?: () => number
): RetryStrategy => {
  switch (config.strategy) {
    case "FIXED":
      return new FixedRetryStrategy(config.initial_delay_ms);
    case "LINEAR":
      return new LinearRetryStrategy(
        config.initial_delay_ms,
        config.initial_delay_ms,
        config.max_delay_ms
      );
    case "EXPONENTIAL":
    default:
      const options = {
        initial_delay_ms: config.initial_delay_ms,
        max_delay_ms: config.max_delay_ms ?? 30_000,
        jitter: config.jitter ?? "FULL"
      } as const;

      return new ExponentialRetryStrategy(
        random ? { ...options, random } : options
      );
  }
};

export const toRetryPolicyFromConfig = (
  config: RetryConfig | undefined,
  fallback: RetryConfig,
  random?: () => number
): RetryPolicy => {
  const resolvedConfig = resolveRetryConfig(config, fallback);
  const strategy = createRetryStrategyFromConfig(resolvedConfig, random);

  return toRetryPolicy(resolvedConfig, strategy);
};
