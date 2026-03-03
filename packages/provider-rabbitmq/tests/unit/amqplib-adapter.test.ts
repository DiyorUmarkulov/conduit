import { describe, expect, it } from "vitest";

import { AmqplibPublisherClient } from "../../src/amqplib-adapter.js";

describe("AmqplibPublisherClient", () => {
  it("publishes payload and waits for confirms", async () => {
    let confirmed = false;
    const published: Array<{ exchange: string; routing_key: string }> = [];

    const client = new AmqplibPublisherClient({
      publish: (exchange, routingKey) => {
        published.push({
          exchange,
          routing_key: routingKey
        });
        return true;
      },
      waitForConfirms: async () => {
        confirmed = true;
      }
    });

    await client.publish({
      exchange: "conduit.operations",
      routing_key: "event.inventory.updated",
      payload: "payload"
    });

    expect(published).toHaveLength(1);
    expect(confirmed).toBe(true);
  });
});
