import type { IOutboxDbAdapter } from "./db-adapter.interface.js";
import { mapSqlRowToOutboxRecord, type SqlOutboxRow } from "./sql-record-mapper.js";
import { assertSafeIdentifier, toIsoString } from "./sql-utils.js";
import type {
  OutboxClaimOptions,
  OutboxRecord,
  OutboxRecordFilter,
  OutboxRetryUpdate
} from "../outbox-record.js";
import { OUTBOX_PARTITION_ORDERING } from "../outbox-record.js";

interface PgQueryResult<Row extends object> {
  rows: Row[];
  rowCount: number | null;
}

export interface PgQueryable {
  query<Row extends object = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[]
  ): Promise<PgQueryResult<Row>>;
}

export interface PgOutboxAdapterOptions {
  table_name?: string;
}

export class PgOutboxAdapter implements IOutboxDbAdapter {
  private readonly tableName: string;

  public constructor(
    private readonly db: PgQueryable,
    options: PgOutboxAdapterOptions = {}
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
      VALUES (
        $1, $2, $3, $4, $5,
        $6::jsonb,
        $7::jsonb,
        $8, $9, $10,
        $11, $12, $13, $14, $15
      )
    `;

    await this.db.query(query, [
      record.id,
      record.operation_id,
      record.route.operation_name,
      record.route.operation_type,
      record.handler_id,
      JSON.stringify(record.route),
      JSON.stringify(record.envelope),
      record.status,
      record.attempt_number,
      toIsoString(record.next_attempt_at),
      record.partition_key ?? null,
      record.last_error ?? null,
      toIsoString(record.created_at),
      toIsoString(record.updated_at),
      record.delivered_at ? toIsoString(record.delivered_at) : null
    ]);
  }

  public async pendingCount(operationName?: string): Promise<number> {
    if (operationName) {
      const query = `
        SELECT COUNT(*)::int AS count
        FROM ${this.tableName}
        WHERE status = 'PENDING' AND operation_name = $1
      `;

      const result = await this.db.query<{ count: number }>(query, [operationName]);
      return result.rows[0]?.count ?? 0;
    }

    const query = `
      SELECT COUNT(*)::int AS count
      FROM ${this.tableName}
      WHERE status = 'PENDING'
    `;

    const result = await this.db.query<{ count: number }>(query);
    return result.rows[0]?.count ?? 0;
  }

  public async claimPending(options: OutboxClaimOptions): Promise<OutboxRecord[]> {
    const nowIso = options.now.toISOString();
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

    const query = `
      WITH claimed AS (
        SELECT candidate.id
        FROM ${this.tableName} candidate
        WHERE candidate.status = 'PENDING'
          AND candidate.next_attempt_at <= $1
          ${partitionOrderingFilter}
        ORDER BY candidate.created_at, candidate.id
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ${this.tableName} outbox
      SET status = 'PROCESSING',
          updated_at = $1
      FROM claimed
      WHERE outbox.id = claimed.id
      RETURNING outbox.*
    `;

    const result = await this.db.query<SqlOutboxRow>(query, [
      nowIso,
      Math.max(0, options.limit)
    ]);

    return result.rows.map(mapSqlRowToOutboxRecord);
  }

  public async markDelivered(recordId: string, deliveredAt: Date): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'DELIVERED',
          delivered_at = $2,
          updated_at = $2
      WHERE id = $1
    `;

    await this.db.query(query, [recordId, deliveredAt.toISOString()]);
  }

  public async scheduleRetry(recordId: string, update: OutboxRetryUpdate): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'PENDING',
          attempt_number = $2,
          next_attempt_at = $3,
          last_error = $4,
          updated_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [
      recordId,
      update.attempt_number,
      update.next_attempt_at.toISOString(),
      update.last_error
    ]);
  }

  public async markFailed(recordId: string, lastError: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'FAILED',
          last_error = $2,
          updated_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [recordId, lastError]);
  }

  public async releaseClaim(recordId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'PENDING',
          updated_at = NOW()
      WHERE id = $1
        AND status = 'PROCESSING'
    `;

    await this.db.query(query, [recordId]);
  }

  public async list(filter: OutboxRecordFilter = {}): Promise<OutboxRecord[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filter.operation_name) {
      params.push(filter.operation_name);
      conditions.push(`operation_name = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT *
      FROM ${this.tableName}
      ${whereClause}
      ORDER BY created_at
    `;

    const result = await this.db.query<SqlOutboxRow>(query, params);
    return result.rows.map(mapSqlRowToOutboxRecord);
  }
}
