import { describe, expect, it } from "vitest";

import { createConduitMiddleware, extractTraceId } from "../../src/index.js";
import type { ConduitRequestLike } from "../../src/conduit-middleware.js";

describe("@conduit/express helpers", () => {
  it("extracts trace id", () => {
    const traceId = extractTraceId({
      headers: {
        traceparent:
          "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      }
    });

    expect(traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it("injects conduit context into request", () => {
    const middleware = createConduitMiddleware({} as never);
    const request: ConduitRequestLike = {
      headers: {}
    };

    middleware(request, {}, () => undefined);

    expect(request.conduit).toBeDefined();
  });
});
