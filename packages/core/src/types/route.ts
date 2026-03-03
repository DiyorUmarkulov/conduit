import type { BackpressurePolicy } from "./backpressure.js";
import type { OperationType } from "./operation.js";

export const ON_EXHAUSTED_ACTIONS = ["DLQ", "LOG_AND_DROP", "RAISE"] as const;

export type OnExhaustedAction = (typeof ON_EXHAUSTED_ACTIONS)[number];

export type BackoffStrategyType = "FIXED" | "LINEAR" | "EXPONENTIAL";

export type JitterMode = "NONE" | "FULL" | "EQUAL";

export interface RetryConfig {
  max_attempts: number;
  strategy: BackoffStrategyType;
  initial_delay_ms: number;
  max_delay_ms?: number;
  jitter?: JitterMode;
  retry_on?: (error: unknown) => boolean;
}

export interface RouteConfig {
  operation_name: string;
  operation_type: OperationType;
  provider: string;
  timeout_ms?: number;
  reply_to?: string;
  retry?: RetryConfig;
  on_exhausted: OnExhaustedAction;
  backpressure?: BackpressurePolicy;
}
