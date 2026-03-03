import { randomBytes } from "node:crypto";

import type { SpanContext } from "./tracer.js";

export interface TraceContextCarrier {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
}

const TRACEPARENT_HEADER = "traceparent";
const TRACEPARENT_RE =
  /^00-(?<trace_id>[0-9a-f]{32})-(?<span_id>[0-9a-f]{16})-(?<flags>[0-9a-f]{2})$/i;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

const generateTraceId = (): string => toHex(randomBytes(16));
const generateSpanId = (): string => toHex(randomBytes(8));

export const toTraceparent = (
  context: SpanContext,
  sampled = true
): string => {
  const flags = sampled ? "01" : "00";
  return `00-${context.trace_id}-${context.span_id}-${flags}`;
};

export const parseTraceparent = (input: string): SpanContext | null => {
  const match = input.trim().match(TRACEPARENT_RE);

  if (!match?.groups) {
    return null;
  }

  const traceId = match.groups.trace_id;
  const spanId = match.groups.span_id;

  if (!traceId || !spanId) {
    return null;
  }

  return {
    trace_id: traceId.toLowerCase(),
    span_id: spanId.toLowerCase()
  };
};

export interface ITraceContextPropagator {
  inject(carrier: TraceContextCarrier, context: SpanContext): void;
  extract(carrier: TraceContextCarrier): SpanContext | null;
}

export class W3CTraceContextPropagator implements ITraceContextPropagator {
  public inject(carrier: TraceContextCarrier, context: SpanContext): void {
    carrier.set(TRACEPARENT_HEADER, toTraceparent(context));
  }

  public extract(carrier: TraceContextCarrier): SpanContext | null {
    const traceparent = carrier.get(TRACEPARENT_HEADER);

    if (!traceparent) {
      return null;
    }

    return parseTraceparent(traceparent);
  }
}

export const createTraceContext = (existing?: SpanContext): SpanContext =>
  existing ?? {
    trace_id: generateTraceId(),
    span_id: generateSpanId()
  };
