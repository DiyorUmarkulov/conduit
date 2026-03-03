import type { IOutboxDbAdapter } from "../adapters/db-adapter.interface.js";
import { OutboxProvider } from "../outbox-provider.js";
import { OutboxRelay, type OutboxRelayOptions } from "../outbox-relay.js";

export type OrderedOutboxRelayOptions = Omit<OutboxRelayOptions, "partition_ordering">;

export const createOrderedOutboxRelay = (
  adapter: IOutboxDbAdapter,
  provider: OutboxProvider,
  options: OrderedOutboxRelayOptions = {}
): OutboxRelay =>
  new OutboxRelay(adapter, provider, {
    ...options,
    partition_ordering: "BY_PARTITION_KEY"
  });
