import { describe, expect, it } from "vitest";

import { EnvelopeBuilder } from "@conduit/core";

import { InMemorySubscription } from "../../src/inmemory-subscription.js";

describe("InMemorySubscription", () => {
  it("fans out to all matching handlers without consumer group", async () => {
    const subscription = new InMemorySubscription();
    const observed: string[] = [];

    subscription.subscribe("order.*", async () => {
      observed.push("a");
    });

    subscription.subscribe("order.*", async () => {
      observed.push("b");
    });

    await subscription.publish(
      EnvelopeBuilder.event("order.created", { order_id: "o-1" }).build()
    );

    expect(observed.sort()).toEqual(["a", "b"]);
  });

  it("round-robins within a consumer group", async () => {
    const subscription = new InMemorySubscription();
    let first = 0;
    let second = 0;

    subscription.subscribe(
      "payment.*",
      async () => {
        first += 1;
      },
      { consumer_group: "billing" }
    );

    subscription.subscribe(
      "payment.*",
      async () => {
        second += 1;
      },
      { consumer_group: "billing" }
    );

    await subscription.publish(
      EnvelopeBuilder.event("payment.authorized", { id: "p-1" }).build()
    );

    await subscription.publish(
      EnvelopeBuilder.event("payment.authorized", { id: "p-2" }).build()
    );

    expect(first).toBe(1);
    expect(second).toBe(1);
  });

  it("delivers to fan-out handlers and one handler per group", async () => {
    const subscription = new InMemorySubscription();
    let fanout = 0;
    let grouped = 0;

    subscription.subscribe("inventory.*", async () => {
      fanout += 1;
    });

    subscription.subscribe(
      "inventory.*",
      async () => {
        grouped += 1;
      },
      { consumer_group: "sync" }
    );

    subscription.subscribe(
      "inventory.*",
      async () => {
        grouped += 1;
      },
      { consumer_group: "sync" }
    );

    await subscription.publish(
      EnvelopeBuilder.event("inventory.updated", { sku: "sku-1" }).build()
    );

    expect(fanout).toBe(1);
    expect(grouped).toBe(1);
  });
});
