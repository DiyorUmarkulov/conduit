import {
  BACKOFF_STRATEGY,
  JITTER_MODE,
  createUuidV7,
  toRetryPolicyFromConfig,
  type DLQEntry,
  type IDLQManager,
  type RetryConfig
} from "@conduit/core";

import type { IOutboxDbAdapter } from "./adapters/db-adapter.interface.js";
import {
  OUTBOX_PARTITION_ORDERING,
  type OutboxPartitionOrdering,
  type OutboxRecord
} from "./outbox-record.js";
import { OutboxProvider } from "./outbox-provider.js";

export interface OutboxRelayOptions {
  batch_size?: number;
  max_parallelism?: number;
  partition_ordering?: OutboxPartitionOrdering;
  now?: () => Date;
  random?: () => number;
  dlq_manager?: IDLQManager;
}

export interface OutboxRelayRunStats {
  claimed: number;
  delivered: number;
  retried: number;
  failed: number;
  dlq: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_attempts: 3,
  strategy: BACKOFF_STRATEGY.EXPONENTIAL,
  initial_delay_ms: 100,
  max_delay_ms: 5_000,
  jitter: JITTER_MODE.FULL
};

const asErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
};

export class OutboxRelay {
  private readonly batchSize: number;
  private readonly maxParallelism: number;
  private readonly partitionOrdering: OutboxPartitionOrdering;
  private readonly now: () => Date;
  private readonly random: () => number;

  public constructor(
    private readonly adapter: IOutboxDbAdapter,
    private readonly provider: OutboxProvider,
    private readonly options: OutboxRelayOptions = {}
  ) {
    this.batchSize = Math.max(1, options.batch_size ?? 100);
    this.maxParallelism = Math.max(1, options.max_parallelism ?? 1);
    this.partitionOrdering =
      options.partition_ordering ??
      OUTBOX_PARTITION_ORDERING.BY_PARTITION_KEY;
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
  }

  public async runOnce(): Promise<OutboxRelayRunStats> {
    const now = this.now();
    const records = await this.adapter.claimPending({
      limit: this.batchSize,
      now,
      partition_ordering: this.partitionOrdering
    });

    const stats: OutboxRelayRunStats = {
      claimed: records.length,
      delivered: 0,
      retried: 0,
      failed: 0,
      dlq: 0
    };

    await this.processRecords(records, stats);

    return stats;
  }

  private async processRecords(
    records: OutboxRecord[],
    stats: OutboxRelayRunStats
  ): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const parallelism = Math.min(this.maxParallelism, records.length);

    if (parallelism === 1) {
      for (const record of records) {
        await this.safeProcessRecord(record, stats);
      }

      return;
    }

    if (this.partitionOrdering === OUTBOX_PARTITION_ORDERING.BY_PARTITION_KEY) {
      await this.processRecordsWithPartitionOrdering(records, parallelism, stats);
      return;
    }

    await this.processRecordsWithoutPartitionOrdering(records, parallelism, stats);
  }

  private async processRecordsWithoutPartitionOrdering(
    records: OutboxRecord[],
    parallelism: number,
    stats: OutboxRelayRunStats
  ): Promise<void> {
    let cursor = 0;
    const takeNext = (): OutboxRecord | undefined => {
      const index = cursor;
      cursor += 1;
      return records[index];
    };

    const worker = async (): Promise<void> => {
      while (true) {
        const record = takeNext();

        if (!record) {
          return;
        }

        await this.safeProcessRecord(record, stats);
      }
    };

    await Promise.all(
      Array.from({ length: parallelism }, async () => worker())
    );
  }

  private async processRecordsWithPartitionOrdering(
    records: OutboxRecord[],
    parallelism: number,
    stats: OutboxRelayRunStats
  ): Promise<void> {
    const queue = [...records];
    const activePartitionKeys = new Set<string>();
    const waiters: Array<() => void> = [];

    const notifyWaiters = (): void => {
      const pending = [...waiters];
      waiters.length = 0;

      for (const resolve of pending) {
        resolve();
      }
    };

    const waitForPartitionRelease = async (): Promise<void> =>
      new Promise((resolve) => {
        waiters.push(resolve);
      });

    const takeNextEligible = (): OutboxRecord | undefined => {
      for (let index = 0; index < queue.length; index += 1) {
        const record = queue[index];

        if (!record) {
          continue;
        }

        const partitionKey = record.partition_key;

        if (partitionKey && activePartitionKeys.has(partitionKey)) {
          continue;
        }

        queue.splice(index, 1);

        if (partitionKey) {
          activePartitionKeys.add(partitionKey);
        }

        return record;
      }

      return undefined;
    };

    const worker = async (): Promise<void> => {
      while (true) {
        const record = takeNextEligible();

        if (!record) {
          if (queue.length === 0) {
            return;
          }

          await waitForPartitionRelease();
          continue;
        }

        try {
          await this.safeProcessRecord(record, stats);
        } finally {
          if (record.partition_key) {
            activePartitionKeys.delete(record.partition_key);
            notifyWaiters();
          }
        }
      }
    };

    await Promise.all(
      Array.from({ length: parallelism }, async () => worker())
    );
  }

  private async safeProcessRecord(
    record: OutboxRecord,
    stats: OutboxRelayRunStats
  ): Promise<void> {
    try {
      await this.processRecord(record, stats);
    } catch (error) {
      await this.adapter.releaseClaim(record.id);
      stats.failed += 1;

      if (this.options.dlq_manager) {
        await this.options.dlq_manager.put(
          this.buildDlqEntry(record, record.attempt_number + 1, error)
        );
        stats.dlq += 1;
      }
    }
  }

  private async processRecord(
    record: OutboxRecord,
    stats: OutboxRelayRunStats
  ): Promise<void> {
    const handler = this.provider.resolveHandler(record.handler_id);

    if (!handler) {
      await this.handleFailure(record, new Error("Handler not found"), stats);
      return;
    }

    const attemptNumber = record.attempt_number + 1;
    const envelope = {
      ...record.envelope,
      metadata: {
        ...record.envelope.metadata,
        attempt_number: attemptNumber
      }
    };

    try {
      await handler.handle(envelope, {
        attempt_number: attemptNumber
      });

      await this.adapter.markDelivered(record.id, this.now());
      stats.delivered += 1;
    } catch (error) {
      await this.handleFailure(record, error, stats);
    }
  }

  private async handleFailure(
    record: OutboxRecord,
    error: unknown,
    stats: OutboxRelayRunStats
  ): Promise<void> {
    const retryPolicy = toRetryPolicyFromConfig(
      record.route.retry,
      DEFAULT_RETRY_CONFIG,
      this.random
    );

    const retryAttempt = record.attempt_number + 1;
    const retryOn = retryPolicy.retry_on ?? (() => true);
    const shouldRetry =
      retryAttempt < retryPolicy.max_attempts && retryOn(error);

    if (shouldRetry) {
      const delayMs = retryPolicy.strategy.nextDelayMs(retryAttempt);
      const nextAttemptAt = new Date(this.now().getTime() + delayMs);

      await this.adapter.scheduleRetry(record.id, {
        attempt_number: retryAttempt,
        next_attempt_at: nextAttemptAt,
        last_error: asErrorMessage(error)
      });
      stats.retried += 1;
      return;
    }

    if (record.route.on_exhausted === "DLQ" && this.options.dlq_manager) {
      await this.options.dlq_manager.put(
        this.buildDlqEntry(record, retryAttempt, error)
      );
      stats.dlq += 1;
    }

    await this.adapter.markFailed(record.id, asErrorMessage(error));
    stats.failed += 1;
  }

  private buildDlqEntry(
    record: OutboxRecord,
    attempts: number,
    error: unknown
  ): DLQEntry {
    const nowIso = this.now().toISOString();
    const errorMessage = asErrorMessage(error);

    return {
      id: createUuidV7(),
      envelope: record.envelope,
      route: record.route,
      handler_id: record.handler_id,
      attempts,
      last_error: errorMessage,
      created_at: nowIso,
      attempt_history: [
        {
          attempt_number: attempts,
          failed_at: nowIso,
          error: errorMessage
        }
      ]
    };
  }
}
