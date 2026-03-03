import { describe, expect, it } from "vitest";

import {
  ConduitBuilder,
  EnvelopeBuilder,
  type DLQEntry,
  type DLQFilter,
  type IDLQManager,
  type ITransportProvider,
  type ProviderDispatchRequest,
  type ProviderDispatchResult,
  type RouteConfig
} from "../../src/index.js";

class SyncProvider implements ITransportProvider {
  public readonly name = "INMEMORY";

  public async dispatch(request: ProviderDispatchRequest): Promise<ProviderDispatchResult> {
    await request.handler.handle(request.envelope, {
      attempt_number: request.envelope.metadata.attempt_number ?? 1
    });

    return { status: "DELIVERED" };
  }

  public getBacklogSize(_route: RouteConfig): number {
    return 0;
  }
}

class TestDlqManager implements IDLQManager {
  private readonly storage = new Map<string, DLQEntry>();

  public async put(entry: DLQEntry): Promise<void> {
    this.storage.set(entry.id, entry);
  }

  public async list(_filter?: DLQFilter): Promise<DLQEntry[]> {
    return [...this.storage.values()];
  }

  public async remove(entryId: string): Promise<void> {
    this.storage.delete(entryId);
  }
}

describe("TTL expiry", () => {
  it("sends expired operation to DLQ without handler execution", async () => {
    const builder = new ConduitBuilder();
    const dlq = new TestDlqManager();

    builder.addRoute(
      builder
        .route("payment.charge")
        .type("COMMAND")
        .via("INMEMORY")
        .onExhausted("DLQ")
    );

    builder.registerProvider(new SyncProvider());
    builder.withDlqManager(dlq);

    const bus = builder.build();

    let invoked = false;

    bus.registerCommandHandler("payment.charge", async () => {
      invoked = true;
      return { ok: true };
    });

    const result = await bus.dispatch(
      EnvelopeBuilder.command("payment.charge", { payment_id: "p-1" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-ttl")
        .withCreatedAt("2020-01-01T00:00:00.000Z")
        .withExpiresAt("2020-01-01T00:00:01.000Z")
        .build()
    );

    const entries = await dlq.list();

    expect(invoked).toBe(false);
    expect(result.status).toBe("DLQ");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.handler_id).toBe("ttl-expired");
  });
});
