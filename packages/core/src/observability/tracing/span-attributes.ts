export const CONDUIT_SPAN_ATTRIBUTES = {
  OPERATION_ID: "conduit.operation.id",
  OPERATION_NAME: "conduit.operation.name",
  OPERATION_TYPE: "conduit.operation.type",
  PROVIDER: "conduit.provider",
  HANDLER_ID: "conduit.handler.id",
  ATTEMPT: "conduit.attempt.number",
  SOURCE_SERVICE: "conduit.source.service",
  SCHEMA_VERSION: "conduit.schema.version",
  STATUS: "conduit.dispatch.status",
  ERROR: "conduit.error"
} as const;

export type ConduitSpanAttributeKey =
  (typeof CONDUIT_SPAN_ATTRIBUTES)[keyof typeof CONDUIT_SPAN_ATTRIBUTES];
