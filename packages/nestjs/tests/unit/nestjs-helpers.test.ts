import { describe, expect, it } from "vitest";

import {
  CONDUIT_COMMAND_HANDLER,
  ConduitCommandHandler,
  createConduitModule,
  extractTraceIdFromHttpHeaders
} from "../../src/index.js";

describe("@conduit/nestjs helpers", () => {
  it("attaches command handler metadata", () => {
    class Handler {}
    ConduitCommandHandler("order.create")(Handler);

    const metadata = (Handler as unknown as Record<symbol, unknown>)[
      CONDUIT_COMMAND_HANDLER
    ] as { operation_name: string };

    expect(metadata.operation_name).toBe("order.create");
  });

  it("creates module definition", () => {
    const module = createConduitModule({
      bus: {} as never
    });

    expect(module.providers[0]?.token).toBe("CONDUIT_BUS");
  });

  it("extracts trace id from traceparent", () => {
    const traceId = extractTraceIdFromHttpHeaders({
      headers: {
        traceparent:
          "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      }
    });

    expect(traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });
});
