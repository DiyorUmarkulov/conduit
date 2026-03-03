import { describe, expect, it } from "vitest";

import type { PgQueryable } from "../../src/adapters/pg-adapter.js";
import { PgOutboxAdapter } from "../../src/adapters/pg-adapter.js";

class FakePgClient implements PgQueryable {
  public readonly calls: Array<{ text: string; params: readonly unknown[] | undefined }> = [];
  private readonly queue: Array<{ rows: Record<string, unknown>[]; rowCount: number | null }> = [];

  public enqueueResult(rows: Record<string, unknown>[], rowCount: number | null = rows.length): void {
    this.queue.push({ rows, rowCount });
  }

  public async query<Row extends object = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[]
  ): Promise<{ rows: Row[]; rowCount: number | null }> {
    this.calls.push({ text, params });

    const next = this.queue.shift() ?? { rows: [], rowCount: 0 };

    return {
      rows: next.rows as Row[],
      rowCount: next.rowCount
    };
  }
}

describe("PgOutboxAdapter", () => {
  it("claims pending records using SKIP LOCKED and maps JSON fields", async () => {
    const client = new FakePgClient();
    const adapter = new PgOutboxAdapter(client);

    client.enqueueResult([
      {
        id: "row-1",
        operation_id: "op-1",
        route: JSON.stringify({
          operation_name: "order.create",
          operation_type: "COMMAND",
          provider: "OUTBOX",
          on_exhausted: "DLQ"
        }),
        envelope: JSON.stringify({
          operation_id: "op-1",
          operation_type: "COMMAND",
          operation_name: "order.create",
          schema_version: "1.0.0",
          payload: { order_id: "o-1" },
          metadata: {
            trace_id: "t-1",
            source_service: "api-gateway",
            idempotency_key: "idem-1"
          },
          created_at: "2026-01-01T00:00:00.000Z"
        }),
        handler_id: "handler-1",
        status: "PROCESSING",
        attempt_number: 0,
        next_attempt_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:01.000Z",
        partition_key: null,
        last_error: null,
        delivered_at: null
      }
    ]);

    const claimed = await adapter.claimPending({
      limit: 50,
      now: new Date("2026-01-01T00:00:10.000Z")
    });

    expect(client.calls[0]?.text).toContain("FOR UPDATE SKIP LOCKED");
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.route.operation_name).toBe("order.create");
    expect(claimed[0]?.envelope.metadata.idempotency_key).toBe("idem-1");
  });

  it("counts pending records by operation name", async () => {
    const client = new FakePgClient();
    const adapter = new PgOutboxAdapter(client);

    client.enqueueResult([{ count: 42 }]);

    const count = await adapter.pendingCount("payment.charge");

    expect(count).toBe(42);
    expect(client.calls[0]?.text).toContain("operation_name = $1");
    expect(client.calls[0]?.params).toEqual(["payment.charge"]);
  });
});
