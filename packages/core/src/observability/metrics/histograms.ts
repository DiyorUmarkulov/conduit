export const CONDUIT_HISTOGRAMS = {
  OPERATION_DURATION_MS: "conduit_operation_duration_ms"
} as const;

export type ConduitHistogramName =
  (typeof CONDUIT_HISTOGRAMS)[keyof typeof CONDUIT_HISTOGRAMS];
