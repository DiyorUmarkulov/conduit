import { describe, expect, it } from "vitest";

import {
  createConduitTestBus,
  makeCommandEnvelope,
  RecordedDispatchBus,
  registerVitestMatchers
} from "../../src/index.js";

registerVitestMatchers();

describe("matchers", () => {
  it("asserts dispatched envelopes", async () => {
    const { bus } = createConduitTestBus((builder) =>
      builder.addRoute(builder.route("order.create").type("COMMAND").via("FAKE"))
    );

    bus.registerCommandHandler("order.create", async () => ({ ok: true }));

    const recorded = new RecordedDispatchBus(bus);
    await recorded.dispatch(
      makeCommandEnvelope("order.create", { order_id: "o-1" })
    );

    expect(recorded).toHaveDispatched("order.create");
    expect(recorded).toHaveDispatchedCommand("order.create");
    expect(recorded).toHaveDispatched("order.create", { times: 1 });
  });
});
