import { describe, expect, it } from "vitest";

import { KafkaJsLagReader, KafkaJsProducerClient } from "../../src/kafkajs-adapter.js";

describe("KafkaJsProducerClient", () => {
  it("maps single message to kafkajs send input", async () => {
    const calls: Array<{ topic: string; messages: Array<{ value: string | Buffer }> }> = [];

    const client = new KafkaJsProducerClient({
      send: async (input) => {
        calls.push({
          topic: input.topic,
          messages: input.messages.map((message) => ({
            value: message.value
          }))
        });
      }
    });

    await client.send({
      topic: "conduit.command.order.create",
      value: "payload"
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.topic).toContain("order.create");
  });
});

describe("KafkaJsLagReader", () => {
  it("sums per-partition lag from high/low offsets", async () => {
    const reader = new KafkaJsLagReader({
      fetchTopicOffsets: async () => [
        {
          partition: 0,
          high: "12",
          low: "3"
        },
        {
          partition: 1,
          high: "7",
          low: "2"
        }
      ]
    });

    const lag = await reader.getLag("topic");
    expect(lag).toBe(14);
  });
});
