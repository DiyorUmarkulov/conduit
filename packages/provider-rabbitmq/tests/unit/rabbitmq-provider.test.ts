import { describe, expect, it } from "vitest";

import {
  DeliveryExhaustedError,
  EnvelopeBuilder,
  type ProviderDispatchRequest
} from "@conduit/core";

import { RabbitMQProvider } from "../../src/rabbitmq-provider.js";
import { CircuitBreakerOpenError } from "../../src/internal/resilience.js";

const createRequest = (
  overrides: Partial<ProviderDispatchRequest["route"]> = {}
): ProviderDispatchRequest => {
  const route: ProviderDispatchRequest["route"] = {
    operation_name: "inventory.updated",
    operation_type: "EVENT",
    provider: "RABBITMQ",
    on_exhausted: "DLQ",
    ...overrides
  };

  return {
    envelope: EnvelopeBuilder.event("inventory.updated", { sku: "sku-1" })
      .withSourceService("inventory")
      .build(),
    route,
    handler: {
      id: "handler-1",
      operation_name: "inventory.updated",
      operation_type: "EVENT",
      version_range: ">=1.0.0 <2.0.0",
      handle: async () => ({ ok: true })
    }
  };
};

describe("RabbitMQProvider", () => {
  it("publishes message and returns QUEUED", async () => {
    const published: string[] = [];

    const provider = new RabbitMQProvider({
      publish: async (input) => {
        published.push(`${input.exchange}:${input.routing_key}`);
      }
    });

    const result = await provider.dispatch(createRequest());

    expect(result.status).toBe("QUEUED");
    expect(published[0]).toContain("conduit.operations");
  });

  it("retries transient publish errors", async () => {
    let attempt = 0;

    const provider = new RabbitMQProvider({
      publish: async () => {
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

  it("opens circuit breaker after failures", async () => {
    const provider = new RabbitMQProvider(
      {
        publish: async () => {
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

    for (let index = 0; index < 2; index += 1) {
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
    }

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
    const provider = new RabbitMQProvider(
      {
        publish: async () => {
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
