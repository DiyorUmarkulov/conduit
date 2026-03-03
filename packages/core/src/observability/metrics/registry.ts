export type MetricLabelValue = string | number | boolean;
export type MetricLabels = Record<string, MetricLabelValue>;

export interface CounterSample {
  labels: MetricLabels;
  value: number;
}

export interface HistogramSample {
  labels: MetricLabels;
  count: number;
  sum: number;
  min: number;
  max: number;
}

export interface GaugeSample {
  labels: MetricLabels;
  value: number;
}

export interface IMetricsRegistry {
  counter(name: string): MetricCounter;
  histogram(name: string): MetricHistogram;
  gauge(name: string): MetricGauge;
}

const normalizeLabels = (labels: MetricLabels): MetricLabels => {
  const normalized: MetricLabels = {};

  for (const key of Object.keys(labels).sort()) {
    const value = labels[key];

    if (value !== undefined) {
      normalized[key] = value;
    }
  }

  return normalized;
};

const toKey = (labels: MetricLabels): string => JSON.stringify(normalizeLabels(labels));

const parseLabels = (key: string): MetricLabels => JSON.parse(key) as MetricLabels;

class SeriesLimit {
  private readonly seen = new Set<string>();

  public constructor(private readonly maxSeries: number) {}

  public allows(metricSeriesKey: string): boolean {
    if (this.seen.has(metricSeriesKey)) {
      return true;
    }

    if (this.seen.size >= this.maxSeries) {
      return false;
    }

    this.seen.add(metricSeriesKey);
    return true;
  }
}

export class MetricCounter {
  private readonly values = new Map<string, number>();

  public constructor(private readonly seriesLimit: SeriesLimit, private readonly name: string) {}

  public inc(labels: MetricLabels = {}, value = 1): void {
    if (!Number.isFinite(value)) {
      return;
    }

    const labelKey = toKey(labels);
    const seriesKey = `${this.name}:${labelKey}`;

    if (!this.seriesLimit.allows(seriesKey)) {
      return;
    }

    const current = this.values.get(labelKey) ?? 0;
    this.values.set(labelKey, current + value);
  }

  public snapshot(): CounterSample[] {
    return [...this.values.entries()].map(([labelKey, value]) => ({
      labels: parseLabels(labelKey),
      value
    }));
  }

  public clear(): void {
    this.values.clear();
  }
}

interface HistogramAggregate {
  count: number;
  sum: number;
  min: number;
  max: number;
}

export class MetricHistogram {
  private readonly values = new Map<string, HistogramAggregate>();

  public constructor(private readonly seriesLimit: SeriesLimit, private readonly name: string) {}

  public observe(value: number, labels: MetricLabels = {}): void {
    if (!Number.isFinite(value)) {
      return;
    }

    const labelKey = toKey(labels);
    const seriesKey = `${this.name}:${labelKey}`;

    if (!this.seriesLimit.allows(seriesKey)) {
      return;
    }

    const current = this.values.get(labelKey);

    if (!current) {
      this.values.set(labelKey, {
        count: 1,
        sum: value,
        min: value,
        max: value
      });
      return;
    }

    current.count += 1;
    current.sum += value;
    current.min = Math.min(current.min, value);
    current.max = Math.max(current.max, value);
    this.values.set(labelKey, current);
  }

  public snapshot(): HistogramSample[] {
    return [...this.values.entries()].map(([labelKey, aggregate]) => ({
      labels: parseLabels(labelKey),
      count: aggregate.count,
      sum: aggregate.sum,
      min: aggregate.min,
      max: aggregate.max
    }));
  }

  public clear(): void {
    this.values.clear();
  }
}

export class MetricGauge {
  private readonly values = new Map<string, number>();

  public constructor(private readonly seriesLimit: SeriesLimit, private readonly name: string) {}

  public set(value: number, labels: MetricLabels = {}): void {
    if (!Number.isFinite(value)) {
      return;
    }

    const labelKey = toKey(labels);
    const seriesKey = `${this.name}:${labelKey}`;

    if (!this.seriesLimit.allows(seriesKey)) {
      return;
    }

    this.values.set(labelKey, value);
  }

  public inc(labels: MetricLabels = {}, by = 1): void {
    const labelKey = toKey(labels);
    const current = this.values.get(labelKey) ?? 0;
    this.set(current + by, labels);
  }

  public dec(labels: MetricLabels = {}, by = 1): void {
    this.inc(labels, -by);
  }

  public snapshot(): GaugeSample[] {
    return [...this.values.entries()].map(([labelKey, value]) => ({
      labels: parseLabels(labelKey),
      value
    }));
  }

  public clear(): void {
    this.values.clear();
  }
}

export interface InMemoryMetricsRegistryOptions {
  max_series?: number;
}

export class InMemoryMetricsRegistry implements IMetricsRegistry {
  private readonly seriesLimit: SeriesLimit;
  private readonly counters = new Map<string, MetricCounter>();
  private readonly histograms = new Map<string, MetricHistogram>();
  private readonly gauges = new Map<string, MetricGauge>();

  public constructor(options: InMemoryMetricsRegistryOptions = {}) {
    this.seriesLimit = new SeriesLimit(Math.max(100, options.max_series ?? 10_000));
  }

  public counter(name: string): MetricCounter {
    const existing = this.counters.get(name);

    if (existing) {
      return existing;
    }

    const counter = new MetricCounter(this.seriesLimit, name);
    this.counters.set(name, counter);
    return counter;
  }

  public histogram(name: string): MetricHistogram {
    const existing = this.histograms.get(name);

    if (existing) {
      return existing;
    }

    const histogram = new MetricHistogram(this.seriesLimit, name);
    this.histograms.set(name, histogram);
    return histogram;
  }

  public gauge(name: string): MetricGauge {
    const existing = this.gauges.get(name);

    if (existing) {
      return existing;
    }

    const gauge = new MetricGauge(this.seriesLimit, name);
    this.gauges.set(name, gauge);
    return gauge;
  }

  public clear(): void {
    for (const counter of this.counters.values()) {
      counter.clear();
    }

    for (const histogram of this.histograms.values()) {
      histogram.clear();
    }

    for (const gauge of this.gauges.values()) {
      gauge.clear();
    }
  }
}
