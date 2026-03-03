import {
  createUuidV7,
  type ITransportProvider,
  type ProviderDispatchRequest,
  type ProviderDispatchResult,
  type RegisteredHandler,
  type RouteConfig
} from "@conduit/core";

import type { IOutboxDbAdapter } from "./adapters/db-adapter.interface.js";
import { cloneEnvelope, cloneRouteConfig } from "./outbox-clone.js";
import type { OutboxRecord } from "./outbox-record.js";

export interface OutboxProviderOptions {
  now?: () => Date;
  partition_key_resolver?: (request: ProviderDispatchRequest) => string | undefined;
}

export class OutboxProvider implements ITransportProvider {
  public readonly name = "OUTBOX";

  private readonly now: () => Date;
  private readonly partitionKeyResolver:
    | ((request: ProviderDispatchRequest) => string | undefined)
    | undefined;
  private readonly handlers = new Map<string, RegisteredHandler>();
  private lastEnqueuedAtMs = 0;

  public constructor(
    private readonly adapter: IOutboxDbAdapter,
    options: OutboxProviderOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.partitionKeyResolver = options.partition_key_resolver;
  }

  public async dispatch(request: ProviderDispatchRequest): Promise<ProviderDispatchResult> {
    this.handlers.set(request.handler.id, request.handler);

    const enqueueAt = this.now();
    const createdAt = this.reserveMonotonicTimestamp(enqueueAt);
    const record: OutboxRecord = {
      id: createUuidV7(createdAt.getTime()),
      operation_id: request.envelope.operation_id,
      route: cloneRouteConfig(request.route),
      envelope: cloneEnvelope(request.envelope),
      handler_id: request.handler.id,
      status: "PENDING",
      attempt_number: 0,
      next_attempt_at: enqueueAt.toISOString(),
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString()
    };

    if (this.partitionKeyResolver) {
      const partitionKey = this.partitionKeyResolver(request);

      if (partitionKey) {
        record.partition_key = partitionKey;
      }
    }

    await this.adapter.insert(record);

    return { status: "QUEUED" };
  }

  public async getBacklogSize(route: RouteConfig): Promise<number> {
    return this.adapter.pendingCount(route.operation_name);
  }

  public resolveHandler(handlerId: string): RegisteredHandler | undefined {
    return this.handlers.get(handlerId);
  }

  public removeHandler(handlerId: string): void {
    this.handlers.delete(handlerId);
  }

  public getAdapter(): IOutboxDbAdapter {
    return this.adapter;
  }

  private reserveMonotonicTimestamp(reference: Date): Date {
    const nowMs = reference.getTime();
    const effectiveMs =
      nowMs > this.lastEnqueuedAtMs ? nowMs : this.lastEnqueuedAtMs + 1;

    this.lastEnqueuedAtMs = effectiveMs;
    return new Date(effectiveMs);
  }
}
