import { EnvelopeBuilder, type OperationEnvelope } from "@conduit/core";

export interface EnvelopeFactoryOptions {
  source_service?: string;
  schema_version?: string;
}

const applyDefaults = (
  builder: EnvelopeBuilder<unknown>,
  options: EnvelopeFactoryOptions
): EnvelopeBuilder<unknown> => {
  if (options.source_service) {
    builder.withSourceService(options.source_service);
  }

  if (options.schema_version) {
    builder.withSchemaVersion(options.schema_version);
  }

  return builder;
};

export const makeCommandEnvelope = (
  operationName: string,
  payload: unknown,
  idempotencyKey = "test-idempotency",
  options: EnvelopeFactoryOptions = {}
): OperationEnvelope =>
  applyDefaults(EnvelopeBuilder.command(operationName, payload), options)
    .withIdempotencyKey(idempotencyKey)
    .build();

export const makeEventEnvelope = (
  operationName: string,
  payload: unknown,
  options: EnvelopeFactoryOptions = {}
): OperationEnvelope =>
  applyDefaults(EnvelopeBuilder.event(operationName, payload), options).build();
