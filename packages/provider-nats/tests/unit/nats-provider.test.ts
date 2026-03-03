import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { NatsProvider } from "../../src/nats-provider.js";

const createRequest = (): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.event("billing.updated", { invoice_id: "inv-1" })
    .withSourceService("billing")
    .build(),
  route: {
    operation_name: "billing.updated",
    operation_type: "EVENT",
    provider: "NATS",
    on_exhausted: "DLQ"
  },
  handler: {
    id: "handler-1",
    operation_name: "billing.updated",
    operation_type: "EVENT",
    version_range: ">=1.0.0 <2.0.0",
    handle: async () => ({ ok: true })
  }
});

describe("NatsProvider", () => {
  it("publishes message and returns QUEUED", async () => {
    const subjects: string[] = [];

    const provider = new NatsProvider({
      publish: async (input) => {
        subjects.push(input.subject);
      }
    });

    const result = await provider.dispatch(createRequest());

    expect(result.status).toBe("QUEUED");
    expect(subjects[0]).toBe("event.billing.updated");
  });
});
