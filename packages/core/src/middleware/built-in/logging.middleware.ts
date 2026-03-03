import {
  CONDUIT_LIFECYCLE_EVENTS,
  NoopLogger,
  type ILogger,
  type StructuredLogEntry
} from "../../observability/index.js";
import type { DispatchMiddleware } from "../middleware-pipeline.js";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
};

export interface LoggingMiddlewareOptions {
  logger?: ILogger;
  now?: () => Date;
}

export const createLoggingMiddleware = (
  options: LoggingMiddlewareOptions = {}
): DispatchMiddleware => {
  const logger = options.logger ?? new NoopLogger();
  const now = options.now ?? (() => new Date());

  return async (context, next) => {
    const started = now();
    const base: Omit<StructuredLogEntry, "timestamp" | "level" | "event" | "message"> = {
      operation_id: context.envelope.operation_id,
      operation_name: context.envelope.operation_name,
      operation_type: context.envelope.operation_type,
      handler_id: context.handler.id,
      provider: context.provider_name,
      source_service: context.envelope.metadata.source_service,
      trace_id: context.envelope.metadata.trace_id,
      ...(context.envelope.metadata.correlation_id
        ? { correlation_id: context.envelope.metadata.correlation_id }
        : {}),
      ...(context.envelope.metadata.attempt_number
        ? { attempt_number: context.envelope.metadata.attempt_number }
        : {})
    };

    logger.log({
      ...base,
      timestamp: started.toISOString(),
      level: "INFO",
      event: CONDUIT_LIFECYCLE_EVENTS.OPERATION_DISPATCH_START,
      message: "Operation dispatch started"
    });

    try {
      await next();

      logger.log({
        ...base,
        timestamp: now().toISOString(),
        level: "INFO",
        event: CONDUIT_LIFECYCLE_EVENTS.OPERATION_DISPATCH_SUCCESS,
        message: "Operation dispatch finished",
        duration_ms: now().getTime() - started.getTime()
      });
    } catch (error) {
      logger.log({
        ...base,
        timestamp: now().toISOString(),
        level: "ERROR",
        event: CONDUIT_LIFECYCLE_EVENTS.OPERATION_DISPATCH_FAILURE,
        message: "Operation dispatch failed",
        duration_ms: now().getTime() - started.getTime(),
        error: toErrorMessage(error)
      });

      throw error;
    }
  };
};
