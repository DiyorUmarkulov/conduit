export class ConduitError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
  }
}

export class ValidationError extends ConduitError {
  public readonly details: string[];

  public constructor(message: string, details: string[] = []) {
    super("VALIDATION_ERROR", message);
    this.details = details;
  }
}

export class NoHandlerError extends ConduitError {
  public constructor(message: string) {
    super("NO_HANDLER", message);
  }
}

export class BackpressureError extends ConduitError {
  public constructor(message: string) {
    super("BACKPRESSURE", message);
  }
}

export interface DeliveryAttemptFailure {
  attempt_number: number;
  failed_at: string;
  error: unknown;
}

export class DeliveryExhaustedError extends ConduitError {
  public readonly attempts: number;
  public readonly last_error: unknown;
  public readonly attempt_history: DeliveryAttemptFailure[];

  public constructor(
    message: string,
    attempts: number,
    lastError: unknown,
    attemptHistory: DeliveryAttemptFailure[] = []
  ) {
    super("DELIVERY_EXHAUSTED", message);
    this.attempts = attempts;
    this.last_error = lastError;
    this.attempt_history = attemptHistory;
  }
}

export class ConfigurationError extends ConduitError {
  public constructor(message: string) {
    super("CONFIGURATION", message);
  }
}

export class AuthorizationError extends ConduitError {
  public constructor(message: string) {
    super("AUTHORIZATION", message);
  }
}

export class CorrelationTimeoutError extends ConduitError {
  public constructor(message: string) {
    super("CORRELATION_TIMEOUT", message);
  }
}
