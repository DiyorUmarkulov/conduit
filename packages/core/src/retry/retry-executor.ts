import { DeliveryExhaustedError } from "../types/errors.js";
import type { RetryPolicy } from "./retry-policy.js";

export interface RetryAttemptRecord {
  attempt_number: number;
  failed_at: string;
  error: unknown;
}

export interface RetryExecutionResult<T> {
  value: T;
  attempts: number;
  attempt_history: RetryAttemptRecord[];
}

const sleep = async (delayMs: number): Promise<void> => {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

export class RetryExecutor {
  public constructor(
    private readonly sleepFn: (delayMs: number) => Promise<void> = sleep
  ) {}

  public async execute<T>(
    operation: (attemptNumber: number) => Promise<T>,
    policy: RetryPolicy
  ): Promise<RetryExecutionResult<T>> {
    const attemptHistory: RetryAttemptRecord[] = [];

    for (let attemptNumber = 1; attemptNumber <= policy.max_attempts; attemptNumber += 1) {
      try {
        const value = await operation(attemptNumber);

        return {
          value,
          attempts: attemptNumber,
          attempt_history: attemptHistory
        };
      } catch (error) {
        attemptHistory.push({
          attempt_number: attemptNumber,
          failed_at: new Date().toISOString(),
          error
        });

        const retryOn = policy.retry_on ?? (() => true);
        const shouldRetry = retryOn(error);
        const isLastAttempt = attemptNumber >= policy.max_attempts;

        if (!shouldRetry) {
          throw error;
        }

        if (isLastAttempt) {
          const exhausted = new DeliveryExhaustedError(
            `Delivery exhausted after ${attemptNumber} attempt(s)`,
            attemptNumber,
            error,
            attemptHistory
          );
          throw exhausted;
        }

        const delay = policy.strategy.nextDelayMs(attemptNumber);
        await this.sleepFn(delay);
      }
    }

    throw new DeliveryExhaustedError("Delivery exhausted", policy.max_attempts, null, attemptHistory);
  }
}
