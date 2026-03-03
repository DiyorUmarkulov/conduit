import { describe, expect, it } from "vitest";

import {
  ACLEvaluator,
  AuthorizationError,
  ConduitBuilder,
  EnvelopeBuilder,
  createAuthorizationMiddleware,
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

describe("Authorization middleware", () => {
  it("blocks unauthorized source_service", async () => {
    const builder = new ConduitBuilder();

    builder.addRoute(
      builder
        .route("order.create")
        .type("COMMAND")
        .via("INMEMORY")
        .onExhausted("RAISE")
    );
    builder.registerProvider(new SyncProvider());

    const acl = new ACLEvaluator([
      {
        effect: "ALLOW",
        source_service: "api-gateway",
        operation_name: "order.*",
        operation_type: "COMMAND"
      },
      {
        effect: "DENY",
        source_service: "*",
        operation_name: "*",
        operation_type: "ALL"
      }
    ]);

    builder.use(createAuthorizationMiddleware({ evaluator: acl }));

    const bus = builder.build();

    bus.registerCommandHandler("order.create", async () => ({ ok: true }));

    await expect(
      bus.dispatch(
        EnvelopeBuilder.command("order.create", { order_id: "o-1" })
          .withSourceService("billing")
          .withIdempotencyKey("idem-1")
          .build()
      )
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("allows authorized source_service", async () => {
    const builder = new ConduitBuilder();

    builder.addRoute(
      builder
        .route("order.create")
        .type("COMMAND")
        .via("INMEMORY")
        .onExhausted("RAISE")
    );
    builder.registerProvider(new SyncProvider());

    const acl = new ACLEvaluator([
      {
        effect: "ALLOW",
        source_service: "api-gateway",
        operation_name: "order.*",
        operation_type: "COMMAND"
      },
      {
        effect: "DENY",
        source_service: "*",
        operation_name: "*",
        operation_type: "ALL"
      }
    ]);

    builder.use(createAuthorizationMiddleware({ evaluator: acl }));

    const bus = builder.build();

    bus.registerCommandHandler("order.create", async () => ({ ok: true }));

    const result = await bus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: "o-1" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-1")
        .build()
    );

    expect(result.status).toBe("DELIVERED");
  });
});
