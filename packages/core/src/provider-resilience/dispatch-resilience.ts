import { RetryExecutor, toRetryPolicyFromConfig } from "../retry/index.js";
import { BackpressureError } from "../types/errors.js";
import {
  BACKOFF_STRATEGY,
  JITTER_MODE,
  type RetryConfig
} from "../types/route.js";

export const CIRCUIT_BREAKER_STATES = ["CLOSED", "OPEN", "HALF_OPEN"] as const;

export type CircuitBreakerState = (typeof CIRCUIT_BREAKER_STATES)[number];

export interface CircuitBreakerOptions {
  failure_threshold?: number;
  reset_timeout_ms?: number;
  half_open_max_calls?: number;
}

export interface DispatchResilienceOptions {
  retry?: RetryConfig;
  timeout_ms?: number;
  max_in_flight?: number;
  circuit_breaker?: CircuitBreakerOptions;
  now?: () => number;
  random?: () => number;
}

export class CircuitBreakerOpenError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_attempts: 5,
  strategy: BACKOFF_STRATEGY.EXPONENTIAL,
  initial_delay_ms: 50,
  max_delay_ms: 2_000,
  jitter: JITTER_MODE.FULL
};

const withTimeout = async <T>(
  task: Promise<T>,
  timeoutMs: number | undefined
): Promise<T> => {
  if (!timeoutMs || timeoutMs <= 0) {
    return task;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Publish timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
};

class CircuitBreakerStateMachine {
  private state: CircuitBreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAtMs = 0;
  private halfOpenCalls = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxCalls: number;

  public constructor(
    private readonly now: () => number,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = Math.max(1, options.failure_threshold ?? 10);
    this.resetTimeoutMs = Math.max(100, options.reset_timeout_ms ?? 10_000);
    this.halfOpenMaxCalls = Math.max(1, options.half_open_max_calls ?? 1);
  }

  public beforeExecution(): void {
    const now = this.now();

    if (this.state === "OPEN") {
      if (now - this.openedAtMs >= this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        this.halfOpenCalls = 0;
      } else {
        throw new CircuitBreakerOpenError("Circuit breaker is open");
      }
    }

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        throw new CircuitBreakerOpenError(
          "Circuit breaker is half-open and saturated"
        );
      }

      this.halfOpenCalls += 1;
    }
  }

  public onSuccess(): void {
    this.consecutiveFailures = 0;

    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.halfOpenCalls = 0;
    }
  }

  public onFailure(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.openedAtMs = this.now();
      this.halfOpenCalls = 0;
      this.consecutiveFailures = this.failureThreshold;
      return;
    }

    this.consecutiveFailures += 1;

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAtMs = this.now();
    }
  }
}

export class DispatchResilience {
  private readonly retryExecutor = new RetryExecutor();
  private readonly now: () => number;
  private readonly maxInFlight: number;
  private readonly timeoutMs: number | undefined;
  private inFlight = 0;
  private readonly circuitBreaker: CircuitBreakerStateMachine;

  public constructor(private readonly options: DispatchResilienceOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.maxInFlight = Math.max(1, options.max_in_flight ?? 2_000);
    this.timeoutMs = options.timeout_ms;
    this.circuitBreaker = new CircuitBreakerStateMachine(
      this.now,
      options.circuit_breaker
    );
  }

  public async run<T>(
    execute: () => Promise<T>,
    routeRetryConfig: RetryConfig | undefined,
    timeoutMs: number | undefined
  ): Promise<T> {
    if (this.inFlight >= this.maxInFlight) {
      throw new BackpressureError(
        `Provider in-flight limit exceeded (${this.maxInFlight})`
      );
    }

    this.circuitBreaker.beforeExecution();
    this.inFlight += 1;

    try {
      const policy = toRetryPolicyFromConfig(
        routeRetryConfig,
        this.options.retry ?? DEFAULT_RETRY_CONFIG,
        this.options.random
      );

      const execution = await this.retryExecutor.execute(
        async () => withTimeout(execute(), timeoutMs ?? this.timeoutMs),
        policy
      );

      this.circuitBreaker.onSuccess();
      return execution.value;
    } catch (error) {
      this.circuitBreaker.onFailure();
      throw error;
    } finally {
      this.inFlight -= 1;
    }
  }

  public getInFlight(): number {
    return this.inFlight;
  }
}
