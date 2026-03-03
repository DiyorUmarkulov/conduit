import { describe, expect, it } from "vitest";

import { ConduitBuilder, EnvelopeBuilder, InMemoryCorrelationStore } from "@conduit/core";
import { InMemoryProvider } from "@conduit/provider-inmemory";

export const scenarioName = "command-correlation";

describe("E2E command-correlation", () => {
  it("returns asynchronous reply using correlation store", async () => {
    const builder = new ConduitBuilder();
    const correlationStore = new InMemoryCorrelationStore();

    builder
      .addRoute(builder.route("payment.charge").type("COMMAND").via("INMEMORY"))
      .registerProvider(new InMemoryProvider())
      .withCorrelationStore(correlationStore);

    const bus = builder.build();

    bus.registerCommandHandler("payment.charge", async (envelope) => {
      const correlationId = envelope.metadata.correlation_id ?? envelope.operation_id;

      const reply = EnvelopeBuilder.event("payment.charge.reply", {
        status: "ACCEPTED"
      })
        .withSourceService("billing")
        .withCorrelationId(correlationId)
        .build();

      setTimeout(() => {
        bus.resolveReply(reply);
      }, 5);

      return { queued: true };
    });

    const result = await bus.dispatchAndWaitForReply(
      EnvelopeBuilder.command("payment.charge", { payment_id: "p-1" })
        .withSourceService("checkout")
        .withIdempotencyKey("idem-p-1")
        .build(),
      {
        timeout_ms: 1_000
      }
    );

    expect(result.dispatch_result.status).toBe("DELIVERED");
    expect(result.reply.operation_name).toBe("payment.charge.reply");
    expect(result.reply.payload).toEqual({
      status: "ACCEPTED"
    });
  });
});
