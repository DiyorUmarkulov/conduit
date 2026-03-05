import type { BackpressurePolicy } from "../types/backpressure.js";
import type {
  BackoffStrategyType,
  JitterMode,
  OnExhaustedAction,
  RetryConfig,
  RouteConfig
} from "../types/route.js";
import { ON_EXHAUSTED_ACTION } from "../types/route.js";
import type { OperationType } from "../types/operation.js";

export interface RetryBuilderInput {
  attempts: number;
  strategy: BackoffStrategyType;
  initial_delay_ms: number;
  max_delay_ms?: number;
  jitter?: JitterMode;
  retry_on?: (error: unknown) => boolean;
}

export class RouteBuilder {
  private readonly route: RouteConfig;

  public constructor(operationName: string) {
    this.route = {
      operation_name: operationName,
      operation_type: "EVENT",
      provider: "INMEMORY",
      on_exhausted: ON_EXHAUSTED_ACTION.DLQ
    };
  }

  public type(operationType: OperationType): this {
    this.route.operation_type = operationType;
    return this;
  }

  public via(provider: string): this {
    this.route.provider = provider;
    return this;
  }

  public withRetry(input: RetryBuilderInput): this {
    const retry: RetryConfig = {
      max_attempts: input.attempts,
      strategy: input.strategy,
      initial_delay_ms: input.initial_delay_ms
    };

    if (input.max_delay_ms !== undefined) {
      retry.max_delay_ms = input.max_delay_ms;
    }

    if (input.jitter !== undefined) {
      retry.jitter = input.jitter;
    }

    if (input.retry_on) {
      retry.retry_on = input.retry_on;
    }

    this.route.retry = retry;
    return this;
  }

  public withTimeoutMs(timeoutMs: number): this {
    this.route.timeout_ms = timeoutMs;
    return this;
  }

  public replyTo(replyTo: string): this {
    this.route.reply_to = replyTo;
    return this;
  }

  public onExhausted(action: OnExhaustedAction): this {
    this.route.on_exhausted = action;
    return this;
  }

  public withBackpressure(policy: BackpressurePolicy): this {
    this.route.backpressure = policy;
    return this;
  }

  public build(): RouteConfig {
    const route: RouteConfig = {
      ...this.route,
    };

    if (this.route.retry) {
      route.retry = { ...this.route.retry };
    }

    if (this.route.backpressure) {
      route.backpressure = { ...this.route.backpressure };
    }

    return route;
  }
}

export const route = (operationName: string): RouteBuilder =>
  new RouteBuilder(operationName);
