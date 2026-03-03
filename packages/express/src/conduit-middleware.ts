import type { ConduitBus } from "@conduit/core";

import { extractTraceId } from "./trace-extractor.js";

export interface ConduitRequestLike {
  headers?: Record<string, string | string[] | undefined>;
  conduit?: {
    bus: ConduitBus;
    trace_id?: string;
  };
}

export type NextFn = (error?: unknown) => void;

export const createConduitMiddleware = (bus: ConduitBus) => {
  return (request: ConduitRequestLike, _response: unknown, next: NextFn): void => {
    const traceId = extractTraceId(request);

    request.conduit = {
      bus,
      ...(traceId ? { trace_id: traceId } : {})
    };

    next();
  };
};
