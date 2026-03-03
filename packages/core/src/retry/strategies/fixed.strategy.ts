import type { RetryStrategy } from "../retry-policy.js";

export class FixedRetryStrategy implements RetryStrategy {
  private readonly delayMs: number;

  public constructor(delayMs: number) {
    this.delayMs = Math.max(0, delayMs);
  }

  public nextDelayMs(): number {
    return this.delayMs;
  }
}
