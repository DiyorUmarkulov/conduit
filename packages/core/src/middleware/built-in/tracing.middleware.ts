import { createTraceContext, NoopTracer, type ITracer } from "../../observability/index.js";
import {
  CONDUIT_SPAN_ATTRIBUTES
} from "../../observability/tracing/span-attributes.js";
import type { DispatchMiddleware } from "../middleware-pipeline.js";

export interface TracingMiddlewareOptions {
  tracer?: ITracer;
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
};

const toTraceIdForEnvelope = (traceId: string): string => {
  if (traceId.length === 32) {
    return traceId;
  }

  return traceId.replaceAll("-", "").slice(0, 32).padEnd(32, "0");
};

export const createTracingMiddleware = (
  options: TracingMiddlewareOptions = {}
): DispatchMiddleware => {
  const tracer = options.tracer ?? new NoopTracer();

  return async (context, next) => {
    const parentContext = createTraceContext({
      trace_id: toTraceIdForEnvelope(context.envelope.metadata.trace_id),
      span_id: createTraceContext().span_id
    });

    const span = tracer.startSpan(`conduit.${context.envelope.operation_name}`, {
      parent_context: parentContext,
      attributes: {
        [CONDUIT_SPAN_ATTRIBUTES.OPERATION_ID]: context.envelope.operation_id,
        [CONDUIT_SPAN_ATTRIBUTES.OPERATION_NAME]: context.envelope.operation_name,
        [CONDUIT_SPAN_ATTRIBUTES.OPERATION_TYPE]: context.envelope.operation_type,
        [CONDUIT_SPAN_ATTRIBUTES.PROVIDER]: context.provider_name,
        [CONDUIT_SPAN_ATTRIBUTES.HANDLER_ID]: context.handler.id,
        [CONDUIT_SPAN_ATTRIBUTES.SOURCE_SERVICE]:
          context.envelope.metadata.source_service,
        [CONDUIT_SPAN_ATTRIBUTES.SCHEMA_VERSION]: context.envelope.schema_version,
        [CONDUIT_SPAN_ATTRIBUTES.ATTEMPT]:
          context.envelope.metadata.attempt_number ?? 1
      }
    });

    try {
      await next();
      span.setAttribute(CONDUIT_SPAN_ATTRIBUTES.STATUS, "OK");
      span.setStatus({ code: "OK" });
    } catch (error) {
      span.setAttribute(CONDUIT_SPAN_ATTRIBUTES.STATUS, "ERROR");
      span.setAttribute(CONDUIT_SPAN_ATTRIBUTES.ERROR, toErrorMessage(error));
      span.recordException(error);
      span.setStatus({
        code: "ERROR",
        message: toErrorMessage(error)
      });
      throw error;
    } finally {
      span.end();
    }
  };
};
