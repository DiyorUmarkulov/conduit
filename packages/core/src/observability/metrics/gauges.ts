export const CONDUIT_GAUGES = {
  OUTBOX_PENDING_TOTAL: "conduit_outbox_pending_total",
  CORRELATION_PENDING_TOTAL: "conduit_correlation_pending_total"
} as const;

export type ConduitGaugeName = (typeof CONDUIT_GAUGES)[keyof typeof CONDUIT_GAUGES];
