import { describe, expect, it } from "vitest";

import { ConduitBuilder } from "../../src/conduit-builder.js";
import { ConduitBus } from "../../src/conduit.js";
import { EnvelopeBuilder } from "../../src/envelope/envelope-builder.js";
import { InMemoryCorrelationStore } from "../../src/correlation/correlation-store.js";
import type {
  ITransportProvider,
  ProviderDispatchRequest,
  ProviderDispatchResult,
  RouteConfig
} from "../../src/types/index.js";

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

describe("ConduitBus dispatchAndWaitForReply", () => {
  it("waits for correlated reply envelope", async () => {
    const builder = new ConduitBuilder();
    const correlationStore = new InMemoryCorrelationStore();

    builder
      .addRoute(builder.route("order.create").type("COMMAND").via("INMEMORY"))
      .registerProvider(new SyncProvider())
      .withCorrelationStore(correlationStore);

    const bus = builder.build();

    bus.registerCommandHandler("order.create", async (envelope) => {
      const reply = EnvelopeBuilder.event("order.create.reply", {
        accepted: true
      })
        .withSourceService("order-service")
        .withCorrelationId(
          envelope.metadata.correlation_id ?? envelope.operation_id
        )
        .build();

      setTimeout(() => {
        bus.resolveReply(reply);
      }, 5);

      return { accepted: true };
    });

    const command = EnvelopeBuilder.command("order.create", {
      order_id: "o-100"
    })
      .withSourceService("api-gateway")
      .withIdempotencyKey("idem-100")
      .build();

    const result = await bus.dispatchAndWaitForReply(command, {
      timeout_ms: 2_000
    });

    expect(result.dispatch_result.status).toBe("DELIVERED");
    expect(result.reply.operation_name).toBe("order.create.reply");
    expect(result.reply.metadata.correlation_id).toBe(command.operation_id);
  });

  it("fails when correlation store is missing", async () => {
    const builder = new ConduitBuilder();

    builder
      .addRoute(builder.route("order.create").type("COMMAND").via("INMEMORY"))
      .registerProvider(new SyncProvider());

    const bus: ConduitBus = builder.build();

    await expect(
      bus.dispatchAndWaitForReply(
        EnvelopeBuilder.command("order.create", { order_id: "o-1" })
          .withSourceService("api-gateway")
          .withIdempotencyKey("idem-1")
          .build()
      )
    ).rejects.toThrowError("Correlation store is not configured");
  });
});
