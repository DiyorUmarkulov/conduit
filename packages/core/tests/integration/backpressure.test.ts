import { describe, expect, it } from "vitest";

import {
  BackpressureError,
  ConduitBuilder,
  EnvelopeBuilder,
  type ITransportProvider,
  type ProviderDispatchRequest,
  type ProviderDispatchResult,
  type RouteConfig
} from "../../src/index.js";

class OverloadedProvider implements ITransportProvider {
  public readonly name = "INMEMORY";

  public async dispatch(_request: ProviderDispatchRequest): Promise<ProviderDispatchResult> {
    return { status: "DELIVERED" };
  }

  public getBacklogSize(_route: RouteConfig): number {
    return 50_000;
  }
}

describe("backpressure", () => {
  it("raises when watermark is exceeded and policy requires exception", async () => {
    const builder = new ConduitBuilder();

    builder.addRoute(
      builder
        .route("payment.charge")
        .type("COMMAND")
        .via("INMEMORY")
        .withBackpressure({
          outbox_watermark: 1,
          block_timeout_ms: 1,
          on_overflow: "RAISE_EXCEPTION"
        })
    );

    builder.registerProvider(new OverloadedProvider());

    const bus = builder.build();

    bus.registerCommandHandler("payment.charge", async () => "ok");

    await expect(
      bus.dispatch(
        EnvelopeBuilder.command("payment.charge", { payment_id: "p-1" })
          .withSourceService("api-gateway")
          .withIdempotencyKey("idem-2")
          .build()
      )
    ).rejects.toBeInstanceOf(BackpressureError);
  });
});
