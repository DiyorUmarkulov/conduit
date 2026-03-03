import type { OperationEnvelope, RouteConfig } from "@conduit/core";

import type { OutboxRecord } from "./outbox-record.js";

export const cloneRouteConfig = (route: RouteConfig): RouteConfig => {
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

export const cloneEnvelope = (envelope: OperationEnvelope): OperationEnvelope => {
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

export const cloneOutboxRecord = (record: OutboxRecord): OutboxRecord => {
  const cloned: OutboxRecord = {
    ...record,
    route: cloneRouteConfig(record.route),
    envelope: cloneEnvelope(record.envelope)
  };

  if (record.partition_key !== undefined) {
    cloned.partition_key = record.partition_key;
  }

  if (record.last_error !== undefined) {
    cloned.last_error = record.last_error;
  }

  if (record.delivered_at !== undefined) {
    cloned.delivered_at = record.delivered_at;
  }

  return cloned;
};
