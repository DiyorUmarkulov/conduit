import type {
  OutboxClaimOptions,
  OutboxRecord,
  OutboxRecordFilter,
  OutboxRetryUpdate
} from "../outbox-record.js";

export interface IOutboxDbAdapter {
  insert(record: OutboxRecord): Promise<void>;
  pendingCount(operationName?: string): Promise<number>;
  claimPending(options: OutboxClaimOptions): Promise<OutboxRecord[]>;
  markDelivered(recordId: string, deliveredAt: Date): Promise<void>;
  scheduleRetry(recordId: string, update: OutboxRetryUpdate): Promise<void>;
  markFailed(recordId: string, lastError: string): Promise<void>;
  releaseClaim(recordId: string): Promise<void>;
  list(filter?: OutboxRecordFilter): Promise<OutboxRecord[]>;
}
