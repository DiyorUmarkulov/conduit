export const BACKPRESSURE_OVERFLOW_ACTIONS = [
  "RAISE_EXCEPTION",
  "DROP",
  "SAMPLE"
] as const;

export type BackpressureOverflowAction =
  (typeof BACKPRESSURE_OVERFLOW_ACTIONS)[number];

export interface BackpressurePolicy {
  outbox_watermark: number;
  block_timeout_ms: number;
  on_overflow: BackpressureOverflowAction;
  sample_rate?: number;
}
