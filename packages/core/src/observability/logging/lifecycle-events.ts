export const CONDUIT_LIFECYCLE_EVENTS = {
  OPERATION_DISPATCH_START: "conduit.operation.dispatch.start",
  OPERATION_DISPATCH_SUCCESS: "conduit.operation.dispatch.success",
  OPERATION_DISPATCH_FAILURE: "conduit.operation.dispatch.failure",
  OPERATION_DISPATCH_RETRY: "conduit.operation.dispatch.retry",
  OPERATION_DROPPED: "conduit.operation.dropped"
} as const;

export type ConduitLifecycleEvent =
  (typeof CONDUIT_LIFECYCLE_EVENTS)[keyof typeof CONDUIT_LIFECYCLE_EVENTS];
