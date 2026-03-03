import { describe, expect, it } from "vitest";

import type { SqliteQueryable } from "../../src/adapters/sqlite-adapter.js";
import { SqliteOutboxAdapter } from "../../src/adapters/sqlite-adapter.js";

class FakeSqliteDb implements SqliteQueryable {
  public readonly runs: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];
  public readonly gets: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];
  public readonly alls: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];

  public allQueue: unknown[] = [];
  public getQueue: unknown[] = [];

  public async run(
    sql: string,
    params?: readonly unknown[]
  ): Promise<{ changes: number }> {
    this.runs.push({ sql, params });
    return { changes: 1 };
  }

  public async get<Row extends object = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<Row | undefined> {
    this.gets.push({ sql, params });
    const next = this.getQueue.shift();
    return next as Row | undefined;
  }

  public async all<Row extends object = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<Row[]> {
    this.alls.push({ sql, params });
    const next = this.allQueue.shift();
    return (next ?? []) as Row[];
  }
}

describe("SqliteOutboxAdapter", () => {
  it("claims pending rows and maps JSON", async () => {
    const db = new FakeSqliteDb();
    const adapter = new SqliteOutboxAdapter(db);

    db.allQueue.push([{ id: "row-1" }]);
    db.allQueue.push([
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
      limit: 5,
      now: new Date("2026-01-01T00:00:10.000Z")
    });

    expect(db.runs[0]?.sql).toContain("SET status = 'PROCESSING'");
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.route.operation_name).toBe("order.create");
  });

  it("counts pending rows", async () => {
    const db = new FakeSqliteDb();
    const adapter = new SqliteOutboxAdapter(db);

    db.getQueue.push({ count: 7 });

    const count = await adapter.pendingCount();

    expect(count).toBe(7);
    expect(db.gets[0]?.sql).toContain("COUNT(*) AS count");
  });
});
