import type { IOutboxDbAdapter } from "./db-adapter.interface.js";
import type {
  OutboxClaimOptions,
  OutboxRecord,
  OutboxRecordFilter,
  OutboxRetryUpdate
} from "../outbox-record.js";
import { OUTBOX_PARTITION_ORDERING } from "../outbox-record.js";
import { cloneOutboxRecord } from "../outbox-clone.js";

export class InMemoryOutboxAdapter implements IOutboxDbAdapter {
  private readonly storage = new Map<string, OutboxRecord>();
  private readonly claimed = new Set<string>();

  public async insert(record: OutboxRecord): Promise<void> {
    this.storage.set(record.id, cloneOutboxRecord(record));
  }

  public async pendingCount(operationName?: string): Promise<number> {
    return [...this.storage.values()].filter((record) => {
      if (record.status !== "PENDING") {
        return false;
      }

      if (operationName && record.route.operation_name !== operationName) {
        return false;
      }

      return true;
    }).length;
  }

  public async claimPending(options: OutboxClaimOptions): Promise<OutboxRecord[]> {
    const nowMs = options.now.getTime();
    const eligible = [...this.storage.values()]
      .filter((record) => {
        if (record.status !== "PENDING") {
          return false;
        }

        if (this.claimed.has(record.id)) {
          return false;
        }

        return new Date(record.next_attempt_at).getTime() <= nowMs;
      })
      .sort((left, right) => {
        const createdAtCompared = left.created_at.localeCompare(right.created_at);

        if (createdAtCompared !== 0) {
          return createdAtCompared;
        }

        return left.id.localeCompare(right.id);
      });

    const limit = Math.max(0, options.limit);
    const candidates =
      options.partition_ordering === OUTBOX_PARTITION_ORDERING.BY_PARTITION_KEY
        ? this.selectPartitionOrderedCandidates(eligible, limit)
        : eligible.slice(0, limit);

    const claimedAt = options.now.toISOString();

    for (const record of candidates) {
      record.status = "PROCESSING";
      record.updated_at = claimedAt;
      this.claimed.add(record.id);
      this.storage.set(record.id, record);
    }

    return candidates.map(cloneOutboxRecord);
  }

  private selectPartitionOrderedCandidates(
    eligible: OutboxRecord[],
    limit: number
  ): OutboxRecord[] {
    if (limit <= 0) {
      return [];
    }

    const selected: OutboxRecord[] = [];
    const selectedKeys = new Set<string>();

    const blockedByProcessing = new Set<string>(
      [...this.storage.values()]
        .filter((record) => record.status === "PROCESSING" && Boolean(record.partition_key))
        .map((record) => record.partition_key as string)
    );

    for (const record of eligible) {
      if (selected.length >= limit) {
        break;
      }

      const partitionKey = record.partition_key;

      if (!partitionKey) {
        selected.push(record);
        continue;
      }

      if (blockedByProcessing.has(partitionKey) || selectedKeys.has(partitionKey)) {
        continue;
      }

      const hasOlderUndelivered = [...this.storage.values()].some((existing) => {
        if (existing.id === record.id) {
          return false;
        }

        if (existing.partition_key !== partitionKey) {
          return false;
        }

        if (existing.status !== "PENDING" && existing.status !== "PROCESSING") {
          return false;
        }

        const createdCompare = existing.created_at.localeCompare(record.created_at);

        if (createdCompare < 0) {
          return true;
        }

        return createdCompare === 0 && existing.id.localeCompare(record.id) < 0;
      });

      if (hasOlderUndelivered) {
        continue;
      }

      selected.push(record);
      selectedKeys.add(partitionKey);
    }

    return selected;
  }

  public async markDelivered(recordId: string, deliveredAt: Date): Promise<void> {
    const record = this.storage.get(recordId);

    if (!record) {
      return;
    }

    record.status = "DELIVERED";
    record.delivered_at = deliveredAt.toISOString();
    record.updated_at = record.delivered_at;
    this.claimed.delete(recordId);
    this.storage.set(recordId, record);
  }

  public async scheduleRetry(recordId: string, update: OutboxRetryUpdate): Promise<void> {
    const record = this.storage.get(recordId);

    if (!record) {
      return;
    }

    record.status = "PENDING";
    record.attempt_number = update.attempt_number;
    record.next_attempt_at = update.next_attempt_at.toISOString();
    record.last_error = update.last_error;
    record.updated_at = new Date().toISOString();
    this.claimed.delete(recordId);
    this.storage.set(recordId, record);
  }

  public async markFailed(recordId: string, lastError: string): Promise<void> {
    const record = this.storage.get(recordId);

    if (!record) {
      return;
    }

    record.status = "FAILED";
    record.last_error = lastError;
    record.updated_at = new Date().toISOString();
    this.claimed.delete(recordId);
    this.storage.set(recordId, record);
  }

  public async releaseClaim(recordId: string): Promise<void> {
    const record = this.storage.get(recordId);

    if (!record) {
      return;
    }

    if (record.status === "PROCESSING") {
      record.status = "PENDING";
      record.updated_at = new Date().toISOString();
      this.storage.set(recordId, record);
    }

    this.claimed.delete(recordId);
  }

  public async list(filter: OutboxRecordFilter = {}): Promise<OutboxRecord[]> {
    return [...this.storage.values()]
      .filter((record) => {
        if (filter.status && record.status !== filter.status) {
          return false;
        }

        if (
          filter.operation_name &&
          record.route.operation_name !== filter.operation_name
        ) {
          return false;
        }

        return true;
      })
      .map(cloneOutboxRecord);
  }
}
