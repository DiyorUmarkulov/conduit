import { EnvelopeBuilder, type OperationEnvelope } from "@conduit/core";

export class CommandBuilder<TPayload = unknown> {
  private builder: EnvelopeBuilder<TPayload>;

  public constructor(operationName: string, payload: TPayload) {
    this.builder = EnvelopeBuilder.command(operationName, payload);
  }

  public withOperationId(operationId: string): this {
    this.builder.withOperationId(operationId);
    return this;
  }

  public withSchemaVersion(schemaVersion: string): this {
    this.builder.withSchemaVersion(schemaVersion);
    return this;
  }

  public withSourceService(sourceService: string): this {
    this.builder.withSourceService(sourceService);
    return this;
  }

  public withTraceId(traceId: string): this {
    this.builder.withTraceId(traceId);
    return this;
  }

  public withCorrelationId(correlationId: string): this {
    this.builder.withCorrelationId(correlationId);
    return this;
  }

  public withCausationId(causationId: string): this {
    this.builder.withCausationId(causationId);
    return this;
  }

  public withIdempotencyKey(idempotencyKey: string): this {
    this.builder.withIdempotencyKey(idempotencyKey);
    return this;
  }

  public withReplyTo(replyTo: string): this {
    this.builder.withReplyTo(replyTo);
    return this;
  }

  public withHeaders(headers: Record<string, string>): this {
    this.builder.withHeaders(headers);
    return this;
  }

  public withCreatedAt(createdAt: string): this {
    this.builder.withCreatedAt(createdAt);
    return this;
  }

  public withExpiresAt(expiresAt: string): this {
    this.builder.withExpiresAt(expiresAt);
    return this;
  }

  public build(): OperationEnvelope<TPayload> {
    return this.builder.build();
  }
}

export const commandBuilder = <TPayload = unknown>(
  operationName: string,
  payload: TPayload
): CommandBuilder<TPayload> => new CommandBuilder(operationName, payload);
