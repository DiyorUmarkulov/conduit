import { describe, expect, it } from "vitest";

import {
  ConduitBuilder,
  EnvelopeBuilder,
  type ITransportProvider,
  type ProviderDispatchRequest,
  type ProviderDispatchResult,
  type RouteConfig
} from "../../src/index.js";

class SyncProvider implements ITransportProvider {
  public readonly name = "INMEMORY";

  public async dispatch(request: ProviderDispatchRequest): Promise<ProviderDispatchResult> {
    await request.handler.handle(request.envelope, {
      attempt_number: request.envelope.metadata.attempt_number ?? 1
    });

    return { status: "DELIVERED" };
  }

  public getBacklogSize(_route: RouteConfig): number {
    return 0;
  }
}

describe("Conduit dispatch lifecycle", () => {
  it("dispatches COMMAND to single handler", async () => {
    const builder = new ConduitBuilder();

    builder.addRoute(
      builder
        .route("order.create")
        .type("COMMAND")
        .via("INMEMORY")
        .withRetry({ attempts: 2, strategy: "FIXED", initial_delay_ms: 0 })
    );

    builder.registerProvider(new SyncProvider());

    const bus = builder.build();

    bus.registerCommandHandler("order.create", async () => ({ ok: true }), {
      version_range: ">=1.0.0 <2.0.0"
    });

    const result = await bus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: "o-1" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-1")
        .build()
    );

    expect(result.status).toBe("DELIVERED");
    expect(result.handler_results).toHaveLength(1);
    expect(result.handler_results[0]?.status).toBe("DELIVERED");
  });

  it("dispatches EVENT to all fan-out handlers", async () => {
    const builder = new ConduitBuilder();

    builder.addRoute(builder.route("inventory.updated").type("EVENT").via("INMEMORY"));
    builder.registerProvider(new SyncProvider());

    const bus = builder.build();

    const calls: string[] = [];

    bus.registerEventHandler("inventory.updated", async () => {
      calls.push("A");
    });

    bus.registerEventHandler("inventory.updated", async () => {
      calls.push("B");
    });

    const result = await bus.dispatch(
      EnvelopeBuilder.event("inventory.updated", { sku: "x" })
        .withSourceService("warehouse")
        .build()
    );

    expect(result.status).toBe("DELIVERED");
    expect(calls.sort()).toEqual(["A", "B"]);
    expect(result.handler_results).toHaveLength(2);
  });
});
