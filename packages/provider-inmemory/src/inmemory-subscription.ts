import type { OperationEnvelope, OperationHandler, OperationType } from "@conduit/core";
import { matchOperationPattern } from "@conduit/core";

export interface InMemorySubscribeOptions {
  operation_type?: OperationType;
  consumer_group?: string;
}

export interface InMemorySubscriptionHandle {
  id: string;
  unsubscribe: () => void;
}

export interface InMemoryPublishOptions {
  continue_on_error?: boolean;
  on_error?: (error: unknown, handler_id: string) => void | Promise<void>;
}

export interface InMemoryPublishResult {
  delivered: string[];
  failed: Array<{ handler_id: string; error: unknown }>;
  skipped: string[];
}

interface InMemorySubscriber {
  id: string;
  pattern: string;
  operation_type?: OperationType;
  consumer_group?: string;
  handler: OperationHandler;
}

export class InMemorySubscription {
  private readonly subscribers: InMemorySubscriber[] = [];
  private readonly groupCursor = new Map<string, number>();
  private sequence = 0;

  public subscribe(
    operationName: string,
    handler: OperationHandler,
    options: InMemorySubscribeOptions = {}
  ): InMemorySubscriptionHandle {
    this.sequence += 1;
    const id = `inmemory-sub-${String(this.sequence).padStart(4, "0")}`;

    this.subscribers.push({
      id,
      pattern: operationName,
      operation_type: options.operation_type,
      consumer_group: options.consumer_group,
      handler
    });

    return {
      id,
      unsubscribe: () => {
        this.remove(id);
      }
    };
  }

  public size(): number {
    return this.subscribers.length;
  }

  public remove(id: string): void {
    const index = this.subscribers.findIndex((entry) => entry.id === id);

    if (index >= 0) {
      this.subscribers.splice(index, 1);
    }
  }

  public async publish(
    envelope: OperationEnvelope,
    options: InMemoryPublishOptions = {}
  ): Promise<InMemoryPublishResult> {
    const matched = this.matchSubscribers(envelope);
    const selected = this.selectByConsumerGroup(matched);
    const skipped = matched
      .filter((entry) => !selected.includes(entry))
      .map((entry) => entry.id);

    if (selected.length === 0) {
      return {
        delivered: [],
        failed: [],
        skipped
      };
    }

    const attemptNumber = envelope.metadata.attempt_number ?? 1;
    const results = await Promise.allSettled(
      selected.map(async (entry) => {
        await Promise.resolve(
          entry.handler(envelope, {
            attempt_number: attemptNumber
          })
        );

        return entry.id;
      })
    );

    const delivered: string[] = [];
    const failed: Array<{ handler_id: string; error: unknown }> = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        delivered.push(result.value);
        return;
      }

      const handlerId = selected[index]?.id ?? "unknown";
      const error = result.reason;
      failed.push({ handler_id: handlerId, error });
    });

    if (options.on_error) {
      for (const failure of failed) {
        await options.on_error(failure.error, failure.handler_id);
      }
    }

    if (!options.continue_on_error && failed.length > 0) {
      throw failed[0]?.error ?? new Error("InMemorySubscription publish failed");
    }

    return {
      delivered,
      failed,
      skipped
    };
  }

  private matchSubscribers(envelope: OperationEnvelope): InMemorySubscriber[] {
    return this.subscribers.filter((entry) => {
      if (entry.operation_type && entry.operation_type !== envelope.operation_type) {
        return false;
      }

      return matchOperationPattern(entry.pattern, envelope.operation_name);
    });
  }

  private selectByConsumerGroup(
    matched: InMemorySubscriber[]
  ): InMemorySubscriber[] {
    if (matched.length <= 1) {
      return matched;
    }

    const selected: InMemorySubscriber[] = [];
    const grouped = new Map<string, InMemorySubscriber[]>();

    for (const entry of matched) {
      if (!entry.consumer_group) {
        selected.push(entry);
        continue;
      }

      const groupEntries = grouped.get(entry.consumer_group) ?? [];
      groupEntries.push(entry);
      grouped.set(entry.consumer_group, groupEntries);
    }

    for (const [groupName, groupEntries] of grouped) {
      const cursor = this.groupCursor.get(groupName) ?? 0;
      const index = cursor % groupEntries.length;
      const selectedEntry = groupEntries[index];

      if (selectedEntry) {
        selected.push(selectedEntry);
      }

      this.groupCursor.set(groupName, cursor + 1);
    }

    return selected;
  }
}
