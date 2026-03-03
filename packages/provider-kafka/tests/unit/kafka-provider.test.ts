import { describe, expect, it } from "vitest";

import {
  DeliveryExhaustedError,
  EnvelopeBuilder,
  type ProviderDispatchRequest
} from "@conduit/core";

import { KafkaProvider } from "../../src/kafka-provider.js";
import { CircuitBreakerOpenError } from "../../src/internal/resilience.js";

const createRequest = (
  overrides: Partial<ProviderDispatchRequest["route"]> = {}
): ProviderDispatchRequest => {
  const route: ProviderDispatchRequest["route"] = {
    operation_name: "order.create",
    operation_type: "COMMAND",
    provider: "KAFKA",
    on_exhausted: "DLQ",
    ...overrides
  };

  return {
    envelope: EnvelopeBuilder.command("order.create", { order_id: "o-1" })
      .withSourceService("api-gateway")
      .withIdempotencyKey("idem-1")
      .build(),
    route,
    handler: {
      id: "handler-1",
      operation_name: "order.create",
      operation_type: "COMMAND",
      version_range: ">=1.0.0 <2.0.0",
      handle: async () => ({ ok: true })
    }
  };
};

describe("KafkaProvider", () => {
  it("publishes message and returns QUEUED", async () => {
    const sent: Array<{ topic: string; key?: string; value: string | Uint8Array }> = [];

    const provider = new KafkaProvider({
      send: async (message) => {
        sent.push({
          topic: message.topic,
          ...(message.key ? { key: message.key } : {}),
          value: message.value
        });
      }
    });

    const result = await provider.dispatch(createRequest());

    expect(result.status).toBe("QUEUED");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.topic).toContain("order.create");
  });

  it("retries transient publish errors", async () => {
    let attempt = 0;

    const provider = new KafkaProvider({
      send: async () => {
        attempt += 1;

        if (attempt < 3) {
          throw new Error("transient");
        }
      }
    });

    const result = await provider.dispatch(
      createRequest({
        retry: {
          max_attempts: 3,
          strategy: "FIXED",
          initial_delay_ms: 0
        }
      })
    );

    expect(result.status).toBe("QUEUED");
    expect(attempt).toBe(3);
  });

  it("opens circuit breaker after configured failures", async () => {
    const provider = new KafkaProvider(
      {
        send: async () => {
          throw new Error("fatal");
        }
      },
      {
        circuit_breaker: {
          failure_threshold: 2,
          reset_timeout_ms: 60_000
        }
      }
    );

    await expect(
      provider.dispatch(
        createRequest({
          retry: {
            max_attempts: 1,
            strategy: "FIXED",
            initial_delay_ms: 0
          }
        })
      )
    ).rejects.toBeInstanceOf(DeliveryExhaustedError);

    await expect(
      provider.dispatch(
        createRequest({
          retry: {
            max_attempts: 1,
            strategy: "FIXED",
            initial_delay_ms: 0
          }
        })
      )
    ).rejects.toBeInstanceOf(DeliveryExhaustedError);

    await expect(
      provider.dispatch(
        createRequest({
          retry: {
            max_attempts: 1,
            strategy: "FIXED",
            initial_delay_ms: 0
          }
        })
      )
    ).rejects.toBeInstanceOf(CircuitBreakerOpenError);
  });

  it("fails on publish timeout", async () => {
    const provider = new KafkaProvider(
      {
        send: async () => {
          await new Promise(() => undefined);
        }
      },
      {
        publish_timeout_ms: 5
      }
    );

    await expect(
      provider.dispatch(
        createRequest({
          retry: {
            max_attempts: 1,
            strategy: "FIXED",
            initial_delay_ms: 0
          }
        })
      )
    ).rejects.toBeInstanceOf(DeliveryExhaustedError);
  });
});
