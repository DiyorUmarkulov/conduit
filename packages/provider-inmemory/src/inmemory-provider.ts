import type {
  ITransportProvider,
  ProviderDispatchRequest,
  ProviderDispatchResult,
  RouteConfig
} from "@conduit/core";
import { PROVIDER_DISPATCH_STATUSES } from "@conduit/core";

export const INMEMORY_PROVIDER_NAME = "INMEMORY" as const;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs?: number): Promise<T> => {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Handler timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
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

export class InMemoryProvider implements ITransportProvider {
  public readonly name = INMEMORY_PROVIDER_NAME;

  private inFlight = 0;
  private syntheticBacklog = 0;

  public async dispatch(request: ProviderDispatchRequest): Promise<ProviderDispatchResult> {
    this.inFlight += 1;

    try {
      const attemptNumber = request.envelope.metadata.attempt_number ?? 1;

      await withTimeout(
        Promise.resolve(
          request.handler.handle(request.envelope, {
            attempt_number: attemptNumber
          })
        ),
        request.timeout_ms
      );

      return { status: PROVIDER_DISPATCH_STATUSES.DELIVERED };
    } finally {
      this.inFlight -= 1;
    }
  }

  public getBacklogSize(_route: RouteConfig): number {
    return this.inFlight + this.syntheticBacklog;
  }

  public setSyntheticBacklog(backlog: number): void {
    this.syntheticBacklog = Math.max(0, Math.floor(backlog));
  }
}
