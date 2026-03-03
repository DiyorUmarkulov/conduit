import { describe, expect, it } from "vitest";

import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";
import {
  InMemoryOutboxAdapter,
  OutboxDLQManager,
  OutboxProvider,
  OutboxRelay
} from "@conduit/provider-outbox";

import { runDlqReplayCommand } from "../../packages/cli/src/commands/dlq-replay.command.js";

export const scenarioName = "dlq-replay";

describe("E2E dlq-replay", () => {
  it("moves exhausted message to DLQ and replays successfully", async () => {
    const adapter = new InMemoryOutboxAdapter();
    const outboxProvider = new OutboxProvider(adapter);
    const dlqManager = new OutboxDLQManager();
    const relay = new OutboxRelay(adapter, outboxProvider, {
      dlq_manager: dlqManager
    });

    const builder = new ConduitBuilder();
    builder
      .addRoute(
        builder
          .route("shipment.reserve")
          .type("COMMAND")
          .via("OUTBOX")
          .withRetry({
            attempts: 1,
            strategy: "FIXED",
            initial_delay_ms: 0
          })
          .onExhausted("DLQ")
      )
      .registerProvider(outboxProvider)
      .withDlqManager(dlqManager);

    const bus = builder.build();

    let failFirst = true;
    let processed = 0;

    bus.registerCommandHandler("shipment.reserve", async () => {
      if (failFirst) {
        failFirst = false;
        throw new Error("transient-shipping-failure");
      }

      processed += 1;
      return { ok: true };
    });

    const dispatchResult = await bus.dispatch(
      EnvelopeBuilder.command("shipment.reserve", { shipment_id: "s-1" })
        .withSourceService("checkout")
        .withIdempotencyKey("idem-s-1")
        .build()
    );

    expect(dispatchResult.status).toBe("QUEUED");

    await relay.runOnce();

    const dlqEntries = await dlqManager.list();
    expect(dlqEntries).toHaveLength(1);

    const logs: string[] = [];
    const replayStatus = await runDlqReplayCommand({
      config: {
        dlq_manager: dlqManager,
        dispatch: async (envelope) => bus.dispatch(envelope)
      },
      entry_id: dlqEntries[0]?.id ?? "",
      output: {
        write: (line) => {
          logs.push(line);
        },
        error: (line) => {
          logs.push(`ERR:${line}`);
        }
      }
    });

    expect(replayStatus).toBe(0);

    for (let index = 0; index < 5; index += 1) {
      await relay.runOnce();

      if ((await adapter.pendingCount("shipment.reserve")) === 0) {
        break;
      }
    }

    expect(processed).toBe(1);
    expect(await dlqManager.list()).toHaveLength(0);
    expect(logs.join("\n")).toContain("Replay succeeded");
  });
});
