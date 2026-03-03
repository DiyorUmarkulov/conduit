import { parseTraceparent } from "@conduit/core";

export interface HeaderCarrier {
  headers?: Record<string, string | undefined>;
}

export const extractTraceIdFromHttpHeaders = (
  request: HeaderCarrier
): string | undefined => {
  const traceparent = request.headers?.traceparent;

  if (!traceparent) {
    return undefined;
  }

  return parseTraceparent(traceparent)?.trace_id;
};
