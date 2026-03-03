import { describe, expect, it } from "vitest";

import { MapDLQManager, asOperationName, type DLQEntry } from "../../../src/index.js";

const createEntry = (id: string, operationName: string): DLQEntry => ({
  id,
  envelope: {
    operation_id: "019ac8df-f2b0-72c9-b65f-53fc76c2800f",
    operation_type: "COMMAND",
    operation_name: asOperationName(operationName),
    schema_version: "1.0.0",
    payload: { value: id },
    metadata: {
      trace_id: `trace-${id}`,
      source_service: "api-gateway",
      idempotency_key: `idem-${id}`,
      headers: {
        request_id: `req-${id}`
      }
    },
    created_at: "2026-01-01T00:00:00.000Z"
  },
  route: {
    operation_name: operationName,
    operation_type: "COMMAND",
    provider: "OUTBOX",
    on_exhausted: "DLQ"
  },
  handler_id: "handler-1",
  attempts: 2,
  last_error: "Error: failed",
  created_at: "2026-01-01T00:00:10.000Z",
  attempt_history: [
    {
      attempt_number: 2,
      failed_at: "2026-01-01T00:00:10.000Z",
      error: "Error: failed"
    }
  ]
});

describe("MapDLQManager", () => {
  it("stores and filters entries", async () => {
    const manager = new MapDLQManager();

    await manager.put(createEntry("a", "order.create"));
    await manager.put(createEntry("b", "payment.charge"));

    const orderEntries = await manager.list({ operation_name: asOperationName("order.create") });
    const allEntries = await manager.list();

    expect(orderEntries).toHaveLength(1);
    expect(orderEntries[0]?.id).toBe("a");
    expect(allEntries).toHaveLength(2);
    expect(manager.size()).toBe(2);
  });

  it("returns defensive copies", async () => {
    const manager = new MapDLQManager();

    await manager.put(createEntry("x", "order.create"));

    const listed = await manager.list();
    const first = listed[0];

    if (!first) {
      throw new Error("Expected first entry");
    }

    first.last_error = "Mutated";

    const listedAgain = await manager.list();

    expect(listedAgain[0]?.last_error).toBe("Error: failed");
  });
});
