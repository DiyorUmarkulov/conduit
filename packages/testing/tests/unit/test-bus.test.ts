import { describe, expect, it } from "vitest";

import {
  createConduitTestBus,
  makeCommandEnvelope,
  RecordedDispatchBus
} from "../../src/index.js";

describe("createConduitTestBus", () => {
  it("dispatches through fake provider and records envelopes", async () => {
    const { bus } = createConduitTestBus((builder) =>
      builder.addRoute(
        builder.route("order.create").type("COMMAND").via("FAKE")
      )
    );

    bus.registerCommandHandler("order.create", async () => ({ ok: true }));

    const recorded = new RecordedDispatchBus(bus);
    const result = await recorded.dispatch(
      makeCommandEnvelope("order.create", {
        order_id: "o-1"
      })
    );

    expect(result.status).toBe("DELIVERED");
    expect(recorded.snapshot()).toHaveLength(1);
  });
});
