import { describe, expect, it } from "vitest";

import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";
import { InMemoryProvider } from "@conduit/provider-inmemory";

export const scenarioName = "event-fanout";

describe("E2E event-fanout", () => {
  it("fans out to non-grouped handlers and balances grouped handlers", async () => {
    const builder = new ConduitBuilder();
    builder
      .addRoute(builder.route("inventory.updated").type("EVENT").via("INMEMORY"))
      .registerProvider(new InMemoryProvider());

    const bus = builder.build();

    let fanoutA = 0;
    let fanoutB = 0;
    let groupedA = 0;
    let groupedB = 0;

    bus.registerEventHandler("inventory.updated", async () => {
      fanoutA += 1;
    });

    bus.registerEventHandler("inventory.updated", async () => {
      fanoutB += 1;
    });

    bus.registerEventHandler(
      "inventory.updated",
      async () => {
        groupedA += 1;
      },
      {
        consumer_group: "projection"
      }
    );

    bus.registerEventHandler(
      "inventory.updated",
      async () => {
        groupedB += 1;
      },
      {
        consumer_group: "projection"
      }
    );

    for (let index = 0; index < 30; index += 1) {
      const result = await bus.dispatch(
        EnvelopeBuilder.event("inventory.updated", {
          sku: `sku-${index}`
        })
          .withSourceService("inventory")
          .build()
      );

      expect(result.status).toBe("DELIVERED");
    }

    expect(fanoutA).toBe(30);
    expect(fanoutB).toBe(30);
    expect(groupedA + groupedB).toBe(30);
    expect(groupedA).toBeGreaterThan(0);
    expect(groupedB).toBeGreaterThan(0);
  });
});
