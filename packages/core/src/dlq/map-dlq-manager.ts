import type { RouteConfig } from "../types/route.js";
import type { OperationEnvelope } from "../types/envelope.js";
import type { DLQEntry } from "./dlq-entry.js";
import type { DLQFilter, IDLQManager } from "./dlq-manager.js";

const cloneRouteConfig = (route: RouteConfig): RouteConfig => {
  const cloned: RouteConfig = {
    operation_name: route.operation_name,
    operation_type: route.operation_type,
    provider: route.provider,
    on_exhausted: route.on_exhausted
  };

  if (route.timeout_ms !== undefined) {
    cloned.timeout_ms = route.timeout_ms;
  }

  if (route.reply_to !== undefined) {
    cloned.reply_to = route.reply_to;
  }

  if (route.retry) {
    cloned.retry = {
      max_attempts: route.retry.max_attempts,
      strategy: route.retry.strategy,
      initial_delay_ms: route.retry.initial_delay_ms,
      ...(route.retry.max_delay_ms !== undefined
        ? { max_delay_ms: route.retry.max_delay_ms }
        : {}),
      ...(route.retry.jitter !== undefined
        ? { jitter: route.retry.jitter }
        : {}),
      ...(route.retry.retry_on ? { retry_on: route.retry.retry_on } : {})
    };
  }

  if (route.backpressure) {
    cloned.backpressure = {
      outbox_watermark: route.backpressure.outbox_watermark,
      block_timeout_ms: route.backpressure.block_timeout_ms,
      on_overflow: route.backpressure.on_overflow,
      ...(route.backpressure.sample_rate !== undefined
        ? { sample_rate: route.backpressure.sample_rate }
        : {})
    };
  }

  return cloned;
};

const cloneEnvelope = (envelope: OperationEnvelope): OperationEnvelope => {
  const metadata = {
    ...envelope.metadata
  };

  if (envelope.metadata.headers) {
    metadata.headers = { ...envelope.metadata.headers };
  }

  const cloned: OperationEnvelope = {
    ...envelope,
    metadata
  };

  if (envelope.expires_at !== undefined) {
    cloned.expires_at = envelope.expires_at;
  }

  return cloned;
};

const cloneEntry = (entry: DLQEntry): DLQEntry => ({
  id: entry.id,
  envelope: cloneEnvelope(entry.envelope),
  route: cloneRouteConfig(entry.route),
  handler_id: entry.handler_id,
  attempts: entry.attempts,
  last_error: entry.last_error,
  created_at: entry.created_at,
  attempt_history: entry.attempt_history.map((attempt) => ({
    attempt_number: attempt.attempt_number,
    failed_at: attempt.failed_at,
    error: attempt.error
  }))
});

export class MapDLQManager implements IDLQManager {
  protected readonly storage = new Map<string, DLQEntry>();

  public async put(entry: DLQEntry): Promise<void> {
    this.storage.set(entry.id, cloneEntry(entry));
  }

  public async list(filter: DLQFilter = {}): Promise<DLQEntry[]> {
    return [...this.storage.values()]
      .filter((entry) => {
        if (filter.operation_name && entry.envelope.operation_name !== filter.operation_name) {
          return false;
        }

        if (filter.handler_id && entry.handler_id !== filter.handler_id) {
          return false;
        }

        return true;
      })
      .map(cloneEntry);
  }

  public async remove(entryId: string): Promise<void> {
    this.storage.delete(entryId);
  }

  public size(): number {
    return this.storage.size;
  }

  public clear(): void {
    this.storage.clear();
  }
}
