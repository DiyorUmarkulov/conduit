import type { RetryConfig } from "../types/route.js";

export interface RetryStrategy {
  nextDelayMs(attemptNumber: number): number;
}

export interface RetryPolicy {
  max_attempts: number;
  strategy: RetryStrategy;
  retry_on?: (error: unknown) => boolean;
}

export const isRetryableByDefault = (error: unknown): boolean => {
  if (
    error instanceof Error &&
    (error.name === "ValidationError" || error.name === "AuthorizationError")
  ) {
    return false;
  }

  return true;
};

export const normalizeMaxAttempts = (attempts: number): number =>
  Math.max(1, Math.floor(attempts));

export const toRetryPolicy = (
  config: RetryConfig,
  strategy: RetryStrategy
): RetryPolicy => ({
  max_attempts: normalizeMaxAttempts(config.max_attempts),
  strategy,
  retry_on: config.retry_on ?? isRetryableByDefault
});
