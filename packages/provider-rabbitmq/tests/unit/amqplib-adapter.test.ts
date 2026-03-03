import { describe, expect, it } from "vitest";

import {
  AmqplibPublisherClient,
  type AmqplibConfirmChannelLike,
  PooledAmqplibPublisherClient
} from "../../src/amqplib-adapter.js";
import { RabbitMQChannelPool } from "../../src/rabbitmq-channel-pool.js";

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

describe("PooledAmqplibPublisherClient", () => {
  it("invalidates channel after publish failure and recovers with a new channel", async () => {
    let created = 0;
    let firstClosed = false;

    const createChannel = (): AmqplibConfirmChannelLike => {
      created += 1;

      if (created === 1) {
        return {
          publish: () => {
            throw new Error("channel failure");
          },
          waitForConfirms: async () => undefined,
          close: async () => {
            firstClosed = true;
          }
        };
      }

      return {
        publish: () => true,
        waitForConfirms: async () => undefined
      };
    };

    const pool = new RabbitMQChannelPool<AmqplibConfirmChannelLike>(
      {
        createConfirmChannel: async () => createChannel()
      },
      {
        size: 1,
        acquire_timeout_ms: 50
      }
    );

    const client = new PooledAmqplibPublisherClient(pool);

    await expect(
      client.publish({
        exchange: "conduit.operations",
        routing_key: "event.inventory.updated",
        payload: "payload"
      })
    ).rejects.toThrow("channel failure");

    await expect(
      client.publish({
        exchange: "conduit.operations",
        routing_key: "event.inventory.updated",
        payload: "payload"
      })
    ).resolves.toBeUndefined();

    expect(created).toBe(2);
    expect(firstClosed).toBe(true);

    await pool.close();
  });
});
