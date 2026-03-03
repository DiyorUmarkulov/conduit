export const CONDUIT_COUNTERS = {
  OPERATIONS_TOTAL: "conduit_operations_total",
  DELIVERY_RETRIES_TOTAL: "conduit_delivery_retries_total",
  DLQ_TOTAL: "conduit_dlq_total",
  BACKPRESSURE_DROPPED_TOTAL: "conduit_backpressure_dropped_total"
} as const;

export type ConduitCounterName = (typeof CONDUIT_COUNTERS)[keyof typeof CONDUIT_COUNTERS];
