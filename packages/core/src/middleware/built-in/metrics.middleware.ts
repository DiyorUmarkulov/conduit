import {
  CONDUIT_COUNTERS,
  CONDUIT_HISTOGRAMS,
  InMemoryMetricsRegistry,
  type IMetricsRegistry,
  type MetricLabels
} from "../../observability/index.js";
import type { DispatchMiddleware } from "../middleware-pipeline.js";

export interface MetricsMiddlewareOptions {
  registry?: IMetricsRegistry;
  now?: () => number;
}

export const createMetricsMiddleware = (
  options: MetricsMiddlewareOptions = {}
): DispatchMiddleware => {
  const registry = options.registry ?? new InMemoryMetricsRegistry();
  const now = options.now ?? (() => Date.now());

  const operationsTotal = registry.counter(CONDUIT_COUNTERS.OPERATIONS_TOTAL);
  const retriesTotal = registry.counter(CONDUIT_COUNTERS.DELIVERY_RETRIES_TOTAL);
  const dlqTotal = registry.counter(CONDUIT_COUNTERS.DLQ_TOTAL);
  const durationMs = registry.histogram(CONDUIT_HISTOGRAMS.OPERATION_DURATION_MS);

  return async (context, next) => {
    const labels: MetricLabels = {
      operation_name: context.envelope.operation_name,
      operation_type: context.envelope.operation_type,
      provider: context.provider_name,
      handler_id: context.handler.id
    };

    const startedAt = now();
    operationsTotal.inc(labels, 1);

    const attempt = context.envelope.metadata.attempt_number ?? 1;

    if (attempt > 1) {
      retriesTotal.inc(labels, 1);
    }

    try {
      await next();
    } catch (error) {
      durationMs.observe(now() - startedAt, {
        ...labels,
        status: "ERROR"
      });

      if (context.route.on_exhausted === "DLQ") {
        dlqTotal.inc(labels, 1);
      }

      throw error;
    }

    durationMs.observe(now() - startedAt, {
      ...labels,
      status: "OK"
    });
  };
};
