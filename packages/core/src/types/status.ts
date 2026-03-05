type ValueOf<T extends Record<string, string>> = T[keyof T];

export const PROVIDER_DISPATCH_STATUSES = {
  DELIVERED: "DELIVERED",
  QUEUED: "QUEUED"
} as const;

export type ProviderDispatchStatus = ValueOf<typeof PROVIDER_DISPATCH_STATUSES>;

export const DISPATCH_STATUSES = {
  DELIVERED: "DELIVERED",
  QUEUED: "QUEUED",
  DLQ: "DLQ",
  DROPPED: "DROPPED"
} as const;

export type DispatchStatus = ValueOf<typeof DISPATCH_STATUSES>;

export const HANDLER_STATUSES = {
  DELIVERED: "DELIVERED",
  QUEUED: "QUEUED",
  DLQ: "DLQ",
  DROPPED: "DROPPED",
  FAILED: "FAILED"
} as const;

export type HandlerStatus = ValueOf<typeof HANDLER_STATUSES>;
