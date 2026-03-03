import type { RetryStrategy } from "../retry-policy.js";

export type ExponentialJitterMode = "NONE" | "FULL" | "EQUAL";

export interface ExponentialRetryStrategyOptions {
  initial_delay_ms: number;
  max_delay_ms: number;
  jitter?: ExponentialJitterMode;
  random?: () => number;
}

export class ExponentialRetryStrategy implements RetryStrategy {
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitter: ExponentialJitterMode;
  private readonly random: () => number;

  public constructor(options: ExponentialRetryStrategyOptions) {
    this.initialDelayMs = Math.max(1, options.initial_delay_ms);
    this.maxDelayMs = Math.max(this.initialDelayMs, options.max_delay_ms);
    this.jitter = options.jitter ?? "NONE";
    this.random = options.random ?? Math.random;
  }

  public nextDelayMs(attemptNumber: number): number {
    const exponent = Math.max(0, attemptNumber - 1);
    const capped = Math.min(this.initialDelayMs * 2 ** exponent, this.maxDelayMs);

    if (this.jitter === "FULL") {
      return this.random() * capped;
    }

    if (this.jitter === "EQUAL") {
      const half = capped / 2;
      return half + this.random() * half;
    }

    return capped;
  }
}
