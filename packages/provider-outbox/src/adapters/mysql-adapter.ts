import type { IOutboxDbAdapter } from "./db-adapter.interface.js";
import { mapSqlRowToOutboxRecord, type SqlOutboxRow } from "./sql-record-mapper.js";
import { asRows, assertSafeIdentifier, placeholders } from "./sql-utils.js";
import type {
  OutboxClaimOptions,
  OutboxRecord,
  OutboxRecordFilter,
  OutboxRetryUpdate
} from "../outbox-record.js";
import { OUTBOX_PARTITION_ORDERING } from "../outbox-record.js";

export interface MySqlTransactionalConnection {
  execute<T = unknown>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<[T, unknown]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface MySqlOutboxAdapterOptions {
  table_name?: string;
}

export class MySqlOutboxAdapter implements IOutboxDbAdapter {
  private readonly tableName: string;

  public constructor(
    private readonly db: MySqlTransactionalConnection,
    options: MySqlOutboxAdapterOptions = {}
  ) {
    this.tableName = assertSafeIdentifier(
      options.table_name ?? "conduit_outbox",
      "table_name"
    );
  }

  public async insert(record: OutboxRecord): Promise<void> {
    const query = `
      INSERT INTO ${this.tableName} (
        id,
        operation_id,
        operation_name,
        operation_type,
        handler_id,
        route,
        envelope,
        status,
        attempt_number,
        next_attempt_at,
        partition_key,
        last_error,
        created_at,
        updated_at,
        delivered_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.execute(query, [
      record.id,
      record.operation_id,
      record.route.operation_name,
      record.route.operation_type,
      record.handler_id,
      JSON.stringify(record.route),
      JSON.stringify(record.envelope),
      record.status,
      record.attempt_number,
      record.next_attempt_at,
      record.partition_key ?? null,
      record.last_error ?? null,
      record.created_at,
      record.updated_at,
      record.delivered_at ?? null
    ]);
  }

  public async pendingCount(operationName?: string): Promise<number> {
    if (operationName) {
      const query = `
        SELECT COUNT(*) AS count
        FROM ${this.tableName}
        WHERE status = 'PENDING' AND operation_name = ?
      `;

      const [rows] = await this.db.execute<{ count: number }[]>(query, [operationName]);
      return asRows<{ count: number }>(rows)[0]?.count ?? 0;
    }

    const query = `
      SELECT COUNT(*) AS count
      FROM ${this.tableName}
      WHERE status = 'PENDING'
    `;

    const [rows] = await this.db.execute<{ count: number }[]>(query);
    return asRows<{ count: number }>(rows)[0]?.count ?? 0;
  }

  public async claimPending(options: OutboxClaimOptions): Promise<OutboxRecord[]> {
    const nowIso = options.now.toISOString();
    const limit = Math.max(0, options.limit);
    const partitionOrderingFilter =
      options.partition_ordering === OUTBOX_PARTITION_ORDERING.BY_PARTITION_KEY
        ? `
          AND (
            candidate.partition_key IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM ${this.tableName} prior
              WHERE prior.partition_key = candidate.partition_key
                AND prior.id <> candidate.id
                AND prior.status IN ('PENDING', 'PROCESSING')
                AND (
                  prior.created_at < candidate.created_at
                  OR (
                    prior.created_at = candidate.created_at
                    AND prior.id < candidate.id
                  )
                )
            )
          )
        `
        : "";

    await this.db.beginTransaction();

    try {
      const claimQuery = `
        SELECT candidate.id
        FROM ${this.tableName} candidate
        WHERE candidate.status = 'PENDING'
          AND candidate.next_attempt_at <= ?
          ${partitionOrderingFilter}
        ORDER BY candidate.created_at, candidate.id
        LIMIT ?
        FOR UPDATE SKIP LOCKED
      `;

      const [idRowsRaw] = await this.db.execute<{ id: string }[]>(claimQuery, [
        nowIso,
        limit
      ]);

      const idRows = asRows<{ id: string }>(idRowsRaw);
      const ids = idRows.map((row) => row.id);

      if (ids.length === 0) {
        await this.db.commit();
        return [];
      }

      const inClause = placeholders(ids.length);

      const updateQuery = `
        UPDATE ${this.tableName}
        SET status = 'PROCESSING',
            updated_at = ?
        WHERE id IN (${inClause})
      `;

      await this.db.execute(updateQuery, [nowIso, ...ids]);

      const readQuery = `
        SELECT *
        FROM ${this.tableName}
        WHERE id IN (${inClause})
      `;

      const [rowsRaw] = await this.db.execute<SqlOutboxRow[]>(readQuery, ids);

      await this.db.commit();

      const rows = asRows<SqlOutboxRow>(rowsRaw);
      return rows.map(mapSqlRowToOutboxRecord);
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }

  public async markDelivered(recordId: string, deliveredAt: Date): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'DELIVERED',
          delivered_at = ?,
          updated_at = ?
      WHERE id = ?
    `;

    const deliveredIso = deliveredAt.toISOString();
    await this.db.execute(query, [deliveredIso, deliveredIso, recordId]);
  }

  public async scheduleRetry(recordId: string, update: OutboxRetryUpdate): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'PENDING',
          attempt_number = ?,
          next_attempt_at = ?,
          last_error = ?,
          updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?
    `;

    await this.db.execute(query, [
      update.attempt_number,
      update.next_attempt_at.toISOString(),
      update.last_error,
      recordId
    ]);
  }

  public async markFailed(recordId: string, lastError: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'FAILED',
          last_error = ?,
          updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?
    `;

    await this.db.execute(query, [lastError, recordId]);
  }

  public async releaseClaim(recordId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'PENDING',
          updated_at = CURRENT_TIMESTAMP(3)
      WHERE id = ?
        AND status = 'PROCESSING'
    `;

    await this.db.execute(query, [recordId]);
  }

  public async list(filter: OutboxRecordFilter = {}): Promise<OutboxRecord[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }

    if (filter.operation_name) {
      conditions.push("operation_name = ?");
      params.push(filter.operation_name);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT *
      FROM ${this.tableName}
      ${whereClause}
      ORDER BY created_at
    `;

    const [rowsRaw] = await this.db.execute<SqlOutboxRow[]>(query, params);
    return asRows<SqlOutboxRow>(rowsRaw).map(mapSqlRowToOutboxRecord);
  }
}
