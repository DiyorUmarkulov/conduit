import { describe, expect, it } from "vitest";

import {
  DeliveryExhaustedError,
  EnvelopeBuilder,
  type ProviderDispatchRequest
} from "@conduit/core";

import { NatsProvider } from "../../src/nats-provider.js";
import { CircuitBreakerOpenError } from "../../src/internal/resilience.js";

const createRequest = (
  overrides: Partial<ProviderDispatchRequest["route"]> = {}
): ProviderDispatchRequest => {
  const route: ProviderDispatchRequest["route"] = {
    operation_name: "billing.updated",
    operation_type: "EVENT",
    provider: "NATS",
    on_exhausted: "DLQ",
    ...overrides
  };

  return {
    envelope: EnvelopeBuilder.event("billing.updated", { invoice_id: "inv-1" })
      .withSourceService("billing")
      .build(),
    route,
    handler: {
      id: "handler-1",
      operation_name: "billing.updated",
      operation_type: "EVENT",
      version_range: ">=1.0.0 <2.0.0",
      handle: async () => ({ ok: true })
    }
  };
};

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

  it("retries transient publish errors", async () => {
    let attempt = 0;

    const provider = new NatsProvider({
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
    const provider = new NatsProvider(
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
    const provider = new NatsProvider(
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
