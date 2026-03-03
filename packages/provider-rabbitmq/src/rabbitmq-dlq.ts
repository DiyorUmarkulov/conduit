import type { DLQEntry, DLQFilter, IDLQManager } from "@conduit/core";

import type { IRabbitPublisherClient } from "./rabbitmq-provider.js";

export interface RabbitMQDLQOptions {
  exchange?: string;
  routing_key?: string;
  cache_entries?: boolean;
}

export class RabbitMQDLQManager implements IDLQManager {
  private readonly exchange: string;
  private readonly routingKey: string;
  private readonly cacheEntries: boolean;
  private readonly cache = new Map<string, DLQEntry>();

  public constructor(
    private readonly publisher: IRabbitPublisherClient,
    options: RabbitMQDLQOptions = {}
  ) {
    this.exchange = options.exchange ?? "conduit.dlq";
    this.routingKey = options.routing_key ?? "dlq";
    this.cacheEntries = options.cache_entries ?? true;
  }

  public async put(entry: DLQEntry): Promise<void> {
    await this.publisher.publish({
      exchange: this.exchange,
      routing_key: this.routingKey,
      payload: JSON.stringify(entry),
      headers: {
        operation_name: entry.route.operation_name,
        handler_id: entry.handler_id
      },
      persistent: true
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
