import type { DLQEntry, DLQFilter, IDLQManager } from "@conduit/core";

import type { IKafkaProducerClient } from "./kafka-provider.js";

export interface KafkaDLQManagerOptions {
  topic?: string;
  cache_entries?: boolean;
}

export class KafkaDLQManager implements IDLQManager {
  private readonly topic: string;
  private readonly cacheEntries: boolean;
  private readonly cache = new Map<string, DLQEntry>();

  public constructor(
    private readonly producer: IKafkaProducerClient,
    options: KafkaDLQManagerOptions = {}
  ) {
    this.topic = options.topic ?? "conduit.dlq";
    this.cacheEntries = options.cache_entries ?? true;
  }

  public async put(entry: DLQEntry): Promise<void> {
    await this.producer.send({
      topic: this.topic,
      key: entry.envelope.operation_id,
      value: JSON.stringify(entry),
      headers: {
        operation_name: entry.route.operation_name,
        handler_id: entry.handler_id
      }
    });

    if (this.cacheEntries) {
      this.cache.set(entry.id, entry);
    }
  }

  public async list(filter: DLQFilter = {}): Promise<DLQEntry[]> {
    return [...this.cache.values()].filter((entry) => {
      if (filter.operation_name && entry.route.operation_name !== filter.operation_name) {
        return false;
      }

      if (filter.handler_id && entry.handler_id !== filter.handler_id) {
        return false;
      }

      return true;
    });
  }

  public async remove(entryId: string): Promise<void> {
    this.cache.delete(entryId);
  }
}
