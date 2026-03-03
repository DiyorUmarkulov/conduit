import type { DLQEntry, DLQFilter, IDLQManager } from "@conduit/core";

import type { INatsClient } from "./nats-provider.js";

export interface NatsDLQManagerOptions {
  subject?: string;
  cache_entries?: boolean;
}

export class NatsDLQManager implements IDLQManager {
  private readonly subject: string;
  private readonly cacheEntries: boolean;
  private readonly cache = new Map<string, DLQEntry>();

  public constructor(
    private readonly client: INatsClient,
    options: NatsDLQManagerOptions = {}
  ) {
    this.subject = options.subject ?? "conduit.dlq";
    this.cacheEntries = options.cache_entries ?? true;
  }

  public async put(entry: DLQEntry): Promise<void> {
    await this.client.publish({
      subject: this.subject,
      payload: JSON.stringify(entry),
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
