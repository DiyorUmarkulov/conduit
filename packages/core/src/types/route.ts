import type { BackpressurePolicy } from "./backpressure.js";
import type { OperationType } from "./operation.js";

type ValueOf<T extends Record<string, string>> = T[keyof T];

export const ON_EXHAUSTED_ACTION = {
  DLQ: "DLQ",
  LOG_AND_DROP: "LOG_AND_DROP",
  RAISE: "RAISE"
} as const;

export const ON_EXHAUSTED_ACTIONS = Object.values(
  ON_EXHAUSTED_ACTION
) as readonly ValueOf<typeof ON_EXHAUSTED_ACTION>[];

export type OnExhaustedAction = (typeof ON_EXHAUSTED_ACTIONS)[number];

export const BACKOFF_STRATEGY = {
  FIXED: "FIXED",
  LINEAR: "LINEAR",
  EXPONENTIAL: "EXPONENTIAL"
} as const;

export const BACKOFF_STRATEGIES = Object.values(
  BACKOFF_STRATEGY
) as readonly ValueOf<typeof BACKOFF_STRATEGY>[];

export type BackoffStrategyType = ValueOf<typeof BACKOFF_STRATEGY>;

export const JITTER_MODE = {
  NONE: "NONE",
  FULL: "FULL",
  EQUAL: "EQUAL"
} as const;

export const JITTER_MODES = Object.values(
  JITTER_MODE
) as readonly ValueOf<typeof JITTER_MODE>[];

export type JitterMode = ValueOf<typeof JITTER_MODE>;

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
