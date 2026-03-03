import type {
  ITransportProvider,
  ProviderDispatchRequest,
  ProviderDispatchResult,
  RouteConfig
} from "@conduit/core";

export interface FakeProviderDispatchRecord {
  request: ProviderDispatchRequest;
  dispatched_at: string;
}

export class FakeProvider implements ITransportProvider {
  public readonly name = "FAKE";

  private readonly records: FakeProviderDispatchRecord[] = [];
  private backlog = 0;

  public async dispatch(
    request: ProviderDispatchRequest
  ): Promise<ProviderDispatchResult> {
    this.records.push({
      request,
      dispatched_at: new Date().toISOString()
    });

    await request.handler.handle(request.envelope, {
      attempt_number: request.envelope.metadata.attempt_number ?? 1
    });

    return {
      status: "DELIVERED"
    };
  }

  public getBacklogSize(_route: RouteConfig): number {
    return this.backlog;
  }

  public setBacklog(size: number): void {
    this.backlog = Math.max(0, Math.floor(size));
  }

  public recordsSnapshot(): FakeProviderDispatchRecord[] {
    return [...this.records];
  }
}
