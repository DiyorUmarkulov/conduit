import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { InMemoryProvider } from "../../src/inmemory-provider.js";

const createRequest = (
  handler: ProviderDispatchRequest["handler"]
): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.command("order.create", { order_id: "o-1" })
    .withSourceService("api")
    .withIdempotencyKey("idem-1")
    .build(),
  route: {
    operation_name: "order.create",
    operation_type: "COMMAND",
    provider: "INMEMORY",
    on_exhausted: "DLQ"
  },
  handler
});

describe("InMemoryProvider", () => {
  it("delivers handler and returns DELIVERED", async () => {
    const provider = new InMemoryProvider();
    let seen = "";

    const result = await provider.dispatch(
      createRequest({
        id: "handler-1",
        operation_name: "order.create",
        operation_type: "COMMAND",
        version_range: ">=1.0.0 <2.0.0",
        handle: async (envelope) => {
          seen = (envelope.payload as { order_id: string }).order_id;
          return { ok: true };
        }
      })
    );

    expect(result.status).toBe("DELIVERED");
    expect(seen).toBe("o-1");
  });

  it("tracks in-flight backlog", async () => {
    const provider = new InMemoryProvider();
    let resolve: (() => void) | undefined;

    const blockingHandler = createRequest({
      id: "handler-2",
      operation_name: "order.create",
      operation_type: "COMMAND",
      version_range: ">=1.0.0 <2.0.0",
      handle: async () =>
        new Promise<void>((res) => {
          resolve = res;
        })
    });

    const dispatchPromise = provider.dispatch(blockingHandler);
    await Promise.resolve();

    expect(provider.getBacklogSize(blockingHandler.route)).toBe(1);

    resolve?.();
    await dispatchPromise;

    expect(provider.getBacklogSize(blockingHandler.route)).toBe(0);
  });

  it("applies synthetic backlog", () => {
    const provider = new InMemoryProvider();

    provider.setSyntheticBacklog(5);

    expect(
      provider.getBacklogSize({
        operation_name: "order.create",
        operation_type: "COMMAND",
        provider: "INMEMORY",
        on_exhausted: "DLQ"
      })
    ).toBe(5);
  });

  it("rejects when handler exceeds timeout", async () => {
    const provider = new InMemoryProvider();

    await expect(
      provider.dispatch({
        ...createRequest({
          id: "handler-timeout",
          operation_name: "order.create",
          operation_type: "COMMAND",
          version_range: ">=1.0.0 <2.0.0",
          handle: async () => new Promise(() => undefined)
        }),
        timeout_ms: 5
      })
    ).rejects.toThrow("Handler timeout");
  });
});
