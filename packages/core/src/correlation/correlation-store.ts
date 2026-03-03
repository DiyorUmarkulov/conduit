import { CorrelationTimeoutError } from "../types/errors.js";
import type { OperationEnvelope } from "../types/envelope.js";

export interface CorrelationAwaitOptions {
  timeout_ms?: number;
  signal?: AbortSignal;
}

export interface ICorrelationStore {
  waitForReply(
    correlationId: string,
    options?: CorrelationAwaitOptions
  ): Promise<OperationEnvelope>;
  resolve(replyEnvelope: OperationEnvelope): boolean;
  reject(correlationId: string, error: unknown): boolean;
  pending(): number;
  clear(): void;
}

interface PendingReply {
  resolve: (reply: OperationEnvelope) => void;
  reject: (error: unknown) => void;
  timer?: NodeJS.Timeout;
}

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
};

export class InMemoryCorrelationStore implements ICorrelationStore {
  private readonly pendingMap = new Map<string, PendingReply>();

  public waitForReply(
    correlationId: string,
    options: CorrelationAwaitOptions = {}
  ): Promise<OperationEnvelope> {
    if (this.pendingMap.has(correlationId)) {
      throw new CorrelationTimeoutError(
        `Correlation id ${correlationId} already has pending listener`
      );
    }

    return new Promise<OperationEnvelope>((resolve, reject) => {
      const pending: PendingReply = {
        resolve: (reply) => {
          this.clearPending(correlationId, pending);
          resolve(reply);
        },
        reject: (error) => {
          this.clearPending(correlationId, pending);
          reject(normalizeError(error));
        }
      };

      const timeoutMs = options.timeout_ms ?? 30_000;

      pending.timer = setTimeout(() => {
        this.clearPending(correlationId, pending);
        reject(
          new CorrelationTimeoutError(
            `Timed out waiting for correlation ${correlationId} after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);

      if (options.signal) {
        const onAbort = (): void => {
          this.clearPending(correlationId, pending);
          reject(new CorrelationTimeoutError("Correlation wait aborted"));
        };

        if (options.signal.aborted) {
          onAbort();
          return;
        }

        options.signal.addEventListener("abort", onAbort, {
          once: true
        });
      }

      this.pendingMap.set(correlationId, pending);
    });
  }

  public resolve(replyEnvelope: OperationEnvelope): boolean {
    const correlationId = replyEnvelope.metadata.correlation_id;

    if (!correlationId) {
      return false;
    }

    const pending = this.pendingMap.get(correlationId);

    if (!pending) {
      return false;
    }

    pending.resolve(replyEnvelope);
    return true;
  }

  public reject(correlationId: string, error: unknown): boolean {
    const pending = this.pendingMap.get(correlationId);

    if (!pending) {
      return false;
    }

    pending.reject(error);
    return true;
  }

  public pending(): number {
    return this.pendingMap.size;
  }

  public clear(): void {
    for (const [correlationId, pending] of this.pendingMap.entries()) {
      this.clearPending(correlationId, pending);
      pending.reject(new CorrelationTimeoutError("Correlation store cleared"));
    }
  }

  private clearPending(correlationId: string, pending: PendingReply): void {
    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    this.pendingMap.delete(correlationId);
  }
}
