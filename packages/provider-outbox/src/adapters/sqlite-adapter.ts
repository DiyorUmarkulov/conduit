import type { IOutboxDbAdapter } from "./db-adapter.interface.js";
import { mapSqlRowToOutboxRecord, type SqlOutboxRow } from "./sql-record-mapper.js";
import { assertSafeIdentifier, placeholders } from "./sql-utils.js";
import type {
  OutboxClaimOptions,
  OutboxRecord,
  OutboxRecordFilter,
  OutboxRetryUpdate
} from "../outbox-record.js";
import { OUTBOX_PARTITION_ORDERING } from "../outbox-record.js";

export interface SqliteResult {
  changes: number;
}

export interface SqliteQueryable {
  run(sql: string, params?: readonly unknown[]): Promise<SqliteResult>;
  get<Row extends object = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<Row | undefined>;
  all<Row extends object = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<Row[]>;
}

export interface SqliteOutboxAdapterOptions {
  table_name?: string;
}

export class SqliteOutboxAdapter implements IOutboxDbAdapter {
  private readonly tableName: string;

  public constructor(
    private readonly db: SqliteQueryable,
    options: SqliteOutboxAdapterOptions = {}
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

    await this.db.run(query, [
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

      const row = await this.db.get<{ count: number }>(query, [operationName]);
      return row?.count ?? 0;
    }

    const query = `
      SELECT COUNT(*) AS count
      FROM ${this.tableName}
      WHERE status = 'PENDING'
    `;

    const row = await this.db.get<{ count: number }>(query);
    return row?.count ?? 0;
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

    const selectQuery = `
      SELECT candidate.id
      FROM ${this.tableName} candidate
      WHERE candidate.status = 'PENDING'
        AND candidate.next_attempt_at <= ?
        ${partitionOrderingFilter}
      ORDER BY candidate.created_at, candidate.id
      LIMIT ?
    `;

    const idRows = await this.db.all<{ id: string }>(selectQuery, [nowIso, limit]);
    const ids = idRows.map((row) => row.id);

    if (ids.length === 0) {
      return [];
    }

    const inClause = placeholders(ids.length);

    const updateQuery = `
      UPDATE ${this.tableName}
      SET status = 'PROCESSING',
          updated_at = ?
      WHERE id IN (${inClause})
        AND status = 'PENDING'
    `;

    await this.db.run(updateQuery, [nowIso, ...ids]);

    const readQuery = `
      SELECT *
      FROM ${this.tableName}
      WHERE id IN (${inClause})
        AND status = 'PROCESSING'
      ORDER BY created_at
    `;

    const rows = await this.db.all<SqlOutboxRow>(readQuery, ids);
    return rows.map(mapSqlRowToOutboxRecord);
  }

  public async markDelivered(recordId: string, deliveredAt: Date): Promise<void> {
    const deliveredIso = deliveredAt.toISOString();

    const query = `
      UPDATE ${this.tableName}
      SET status = 'DELIVERED',
          delivered_at = ?,
          updated_at = ?
      WHERE id = ?
    `;

    await this.db.run(query, [deliveredIso, deliveredIso, recordId]);
  }

  public async scheduleRetry(recordId: string, update: OutboxRetryUpdate): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'PENDING',
          attempt_number = ?,
          next_attempt_at = ?,
          last_error = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await this.db.run(query, [
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
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await this.db.run(query, [lastError, recordId]);
  }

  public async releaseClaim(recordId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'PENDING',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'PROCESSING'
    `;

    await this.db.run(query, [recordId]);
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

    const rows = await this.db.all<SqlOutboxRow>(query, params);
    return rows.map(mapSqlRowToOutboxRecord);
  }
}
