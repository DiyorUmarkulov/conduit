import { parseTraceparent } from "@conduit/core";

export interface HeaderCarrier {
  headers?: Record<string, string | string[] | undefined>;
}

const readHeader = (
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined => {
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const extractTraceId = (request: HeaderCarrier): string | undefined => {
  if (!request.headers) {
    return undefined;
  }

  const traceparent = readHeader(request.headers, "traceparent");

  if (!traceparent) {
    return undefined;
  }

  return parseTraceparent(traceparent)?.trace_id;
};
