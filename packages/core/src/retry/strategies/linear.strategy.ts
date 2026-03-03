import type { RetryStrategy } from "../retry-policy.js";

export class LinearRetryStrategy implements RetryStrategy {
  private readonly initialDelayMs: number;
  private readonly stepMs: number;
  private readonly maxDelayMs: number;

  public constructor(initialDelayMs: number, stepMs: number, maxDelayMs = Number.MAX_SAFE_INTEGER) {
    this.initialDelayMs = Math.max(0, initialDelayMs);
    this.stepMs = Math.max(1, stepMs);
    this.maxDelayMs = Math.max(this.initialDelayMs, maxDelayMs);
  }

  public nextDelayMs(attemptNumber: number): number {
    const rawDelay = this.initialDelayMs + this.stepMs * Math.max(0, attemptNumber - 1);
    return Math.min(rawDelay, this.maxDelayMs);
  }
}
