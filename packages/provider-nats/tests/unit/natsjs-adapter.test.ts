import { describe, expect, it } from "vitest";

import { NatsJsClient } from "../../src/natsjs-adapter.js";

describe("NatsJsClient", () => {
  it("publishes bytes with headers and flushes", async () => {
    let flushed = false;
    const published: Array<{ subject: string; payload: Uint8Array }> = [];

    const client = new NatsJsClient(
      {
        publish: (subject, payload) => {
          published.push({
            subject,
            payload: payload ?? new Uint8Array()
          });
        },
        flush: async () => {
          flushed = true;
        }
      },
      () => {
        const storage = new Map<string, string>();

        return {
          set: (key: string, value: string) => {
            storage.set(key, value);
          }
        };
      }
    );

    await client.publish({
      subject: "event.billing.updated",
      payload: "payload",
      headers: {
        trace_id: "trace-1"
      }
    });

    expect(published).toHaveLength(1);
    expect(published[0]?.subject).toBe("event.billing.updated");
    expect(flushed).toBe(true);
  });
});
