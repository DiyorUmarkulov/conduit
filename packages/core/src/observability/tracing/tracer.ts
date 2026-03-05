import { randomBytes } from "node:crypto";

export const SPAN_STATUS_CODES = ["OK", "ERROR"] as const;

export type SpanStatusCode = (typeof SPAN_STATUS_CODES)[number];

export interface SpanContext {
  trace_id: string;
  span_id: string;
}

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export interface SpanStartOptions {
  parent_context?: SpanContext;
  attributes?: Record<string, string | number | boolean>;
}

export interface ISpan {
  readonly context: SpanContext;
  setAttribute(key: string, value: string | number | boolean): void;
  setAttributes(attributes: Record<string, string | number | boolean>): void;
  setStatus(status: SpanStatus): void;
  recordException(error: unknown): void;
  end(): void;
}

export interface ITracer {
  startSpan(name: string, options?: SpanStartOptions): ISpan;
}

export interface RecordedSpan {
  name: string;
  context: SpanContext;
  parent_context?: SpanContext;
  started_at: string;
  ended_at?: string;
  status: SpanStatus;
  attributes: Record<string, string | number | boolean>;
  exceptions: string[];
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

const createId = (size: number): string => toHex(randomBytes(size));

const normalizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
};

export class NoopSpan implements ISpan {
  public readonly context: SpanContext;

  public constructor(context: SpanContext = { trace_id: "", span_id: "" }) {
    this.context = context;
  }

  public setAttribute(_key: string, _value: string | number | boolean): void {}

  public setAttributes(_attributes: Record<string, string | number | boolean>): void {}

  public setStatus(_status: SpanStatus): void {}

  public recordException(_error: unknown): void {}

  public end(): void {}
}

export class NoopTracer implements ITracer {
  public startSpan(_name: string, options: SpanStartOptions = {}): ISpan {
    return new NoopSpan(
      options.parent_context ?? {
        trace_id: "",
        span_id: ""
      }
    );
  }
}

class RecordedSpanHandle implements ISpan {
  public readonly context: SpanContext;

  private ended = false;

  public constructor(private readonly target: RecordedSpan) {
    this.context = target.context;
  }

  public setAttribute(key: string, value: string | number | boolean): void {
    this.target.attributes[key] = value;
  }

  public setAttributes(attributes: Record<string, string | number | boolean>): void {
    for (const [key, value] of Object.entries(attributes)) {
      this.target.attributes[key] = value;
    }
  }

  public setStatus(status: SpanStatus): void {
    this.target.status = { ...status };
  }

  public recordException(error: unknown): void {
    this.target.exceptions.push(normalizeError(error));
  }

  public end(): void {
    if (this.ended) {
      return;
    }

    this.ended = true;
    this.target.ended_at = new Date().toISOString();
  }
}

export class InMemoryTracer implements ITracer {
  private readonly spans: RecordedSpan[] = [];

  public startSpan(name: string, options: SpanStartOptions = {}): ISpan {
    const context: SpanContext = {
      trace_id: options.parent_context?.trace_id ?? createId(16),
      span_id: createId(8)
    };

    const span: RecordedSpan = {
      name,
      context,
      ...(options.parent_context ? { parent_context: options.parent_context } : {}),
      started_at: new Date().toISOString(),
      status: {
        code: "OK"
      },
      attributes: { ...(options.attributes ?? {}) },
      exceptions: []
    };

    this.spans.push(span);
    return new RecordedSpanHandle(span);
  }

  public snapshot(): RecordedSpan[] {
    return this.spans.map((span) => ({
      ...span,
      context: { ...span.context },
      ...(span.parent_context ? { parent_context: { ...span.parent_context } } : {}),
      status: { ...span.status },
      attributes: { ...span.attributes },
      exceptions: [...span.exceptions]
    }));
  }

  public clear(): void {
    this.spans.length = 0;
  }
}
