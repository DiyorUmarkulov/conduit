import { describe, expect, it } from "vitest";

import {
  ConduitBuilder,
  EnvelopeBuilder,
  type ITransportProvider,
  type ProviderDispatchRequest,
  type ProviderDispatchResult,
  type RouteConfig
} from "../../src/index.js";

class QueuedProvider implements ITransportProvider {
  public readonly name = "OUTBOX";

  public async dispatch(
    _request: ProviderDispatchRequest
  ): Promise<ProviderDispatchResult> {
    return { status: "QUEUED" };
  }

  public getBacklogSize(_route: RouteConfig): number {
    return 0;
  }
}

describe("Queued provider dispatch status", () => {
  it("returns QUEUED when provider enqueues operation", async () => {
    const builder = new ConduitBuilder();

    builder.addRoute(
      builder.route("order.create").type("COMMAND").via("OUTBOX")
    );

    builder.registerProvider(new QueuedProvider());

    const bus = builder.build();

    let executed = false;

    bus.registerCommandHandler("order.create", async () => {
      executed = true;
      return { ok: true };
    });

    const result = await bus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: "o-1" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-1")
        .build()
    );

    expect(result.status).toBe("QUEUED");
    expect(result.handler_results[0]?.status).toBe("QUEUED");
    expect(executed).toBe(false);
  });
});
