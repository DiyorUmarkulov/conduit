import { describe, expect, it } from "vitest";

import type { MySqlTransactionalConnection } from "../../src/adapters/mysql-adapter.js";
import { MySqlOutboxAdapter } from "../../src/adapters/mysql-adapter.js";

class FakeMySqlConnection implements MySqlTransactionalConnection {
  public readonly calls: Array<{ sql: string; params: readonly unknown[] | undefined }> = [];
  public beginCount = 0;
  public commitCount = 0;
  public rollbackCount = 0;
  private readonly queue: Array<[unknown, unknown]> = [];
  private throwOnCall: { index: number; error: Error } | undefined;

  public enqueue(result: [unknown, unknown]): void {
    this.queue.push(result);
  }

  public failOnCall(index: number, error: Error): void {
    this.throwOnCall = { index, error };
  }

  public async execute<T = unknown>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<[T, unknown]> {
    this.calls.push({ sql, params });

    if (this.throwOnCall && this.calls.length === this.throwOnCall.index) {
      throw this.throwOnCall.error;
    }

    const next = this.queue.shift() ?? [[], {}];
    return next as [T, unknown];
  }

  public async beginTransaction(): Promise<void> {
    this.beginCount += 1;
  }

  public async commit(): Promise<void> {
    this.commitCount += 1;
  }

  public async rollback(): Promise<void> {
    this.rollbackCount += 1;
  }
}

describe("MySqlOutboxAdapter", () => {
  it("claims pending rows in transaction with SKIP LOCKED", async () => {
    const connection = new FakeMySqlConnection();
    const adapter = new MySqlOutboxAdapter(connection);

    connection.enqueue([[{ id: "row-1" }], {}]);
    connection.enqueue([[{ affectedRows: 1 }], {}]);
    connection.enqueue([
      [
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
      ],
      {}
    ]);

    const claimed = await adapter.claimPending({
      limit: 10,
      now: new Date("2026-01-01T00:00:10.000Z")
    });

    expect(connection.beginCount).toBe(1);
    expect(connection.commitCount).toBe(1);
    expect(connection.rollbackCount).toBe(0);
    expect(connection.calls[0]?.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.id).toBe("row-1");
  });

  it("rolls back transaction on claim failure", async () => {
    const connection = new FakeMySqlConnection();
    const adapter = new MySqlOutboxAdapter(connection);

    connection.enqueue([[{ id: "row-1" }], {}]);
    connection.failOnCall(2, new Error("db update failed"));

    await expect(
      adapter.claimPending({
        limit: 1,
        now: new Date("2026-01-01T00:00:00.000Z")
      })
    ).rejects.toThrowError("db update failed");

    expect(connection.beginCount).toBe(1);
    expect(connection.rollbackCount).toBe(1);
  });
});
