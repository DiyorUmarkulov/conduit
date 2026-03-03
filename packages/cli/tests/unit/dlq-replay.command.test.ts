import { describe, expect, it } from "vitest";

import {
  asOperationName,
  type DLQEntry,
  type IDLQManager,
  type OperationEnvelope
} from "@conduit/core";

import { runDlqReplayCommand } from "../../src/commands/dlq-replay.command.js";

class FakeDlqManager implements IDLQManager {
  private readonly entries = new Map<string, DLQEntry>();

  public constructor(entry: DLQEntry) {
    this.entries.set(entry.id, entry);
  }

  public async put(entry: DLQEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  public async list(): Promise<DLQEntry[]> {
    return [...this.entries.values()];
  }

  public async remove(entryId: string): Promise<void> {
    this.entries.delete(entryId);
  }
}

const createOutput = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    io: {
      write: (message: string) => {
        stdout.push(message);
      },
      error: (message: string) => {
        stderr.push(message);
      }
    }
  };
};

const envelope: OperationEnvelope = {
  operation_id: "019ac8df-f2b0-72c9-b65f-53fc76c2800f",
  operation_type: "COMMAND",
  operation_name: asOperationName("order.create"),
  schema_version: "1.0.0",
  payload: { order_id: "o-1" },
  metadata: {
    trace_id: "trace-1",
    source_service: "api-gateway",
    idempotency_key: "idem-1"
  },
  created_at: "2026-01-01T00:00:00.000Z"
};

const entry: DLQEntry = {
  id: "entry-1",
  envelope,
  route: {
    operation_name: "order.create",
    operation_type: "COMMAND",
    provider: "OUTBOX",
    on_exhausted: "DLQ"
  },
  handler_id: "handler-1",
  attempts: 2,
  last_error: "Error",
  created_at: "2026-01-01T00:00:10.000Z",
  attempt_history: [
    {
      attempt_number: 2,
      failed_at: "2026-01-01T00:00:10.000Z",
      error: "Error"
    }
  ]
};

describe("dlq replay command", () => {
  it("replays and removes entry", async () => {
    const dlq = new FakeDlqManager(entry);
    const output = createOutput();
    let replayed: OperationEnvelope | undefined;

    const status = await runDlqReplayCommand({
      config: {
        dlq_manager: dlq,
        dispatch: async (value) => {
          replayed = value;
          return { ok: true };
        }
      },
      entry_id: entry.id,
      output: output.io
    });

    const remaining = await dlq.list();

    expect(status).toBe(0);
    expect(replayed?.operation_id).toBe(envelope.operation_id);
    expect(remaining).toHaveLength(0);
  });

  it("supports dry-run mode", async () => {
    const dlq = new FakeDlqManager(entry);
    const output = createOutput();

    const status = await runDlqReplayCommand({
      config: {
        dlq_manager: dlq,
        dispatch: async () => ({ ok: true })
      },
      entry_id: entry.id,
      dry_run: true,
      output: output.io
    });

    const remaining = await dlq.list();

    expect(status).toBe(0);
    expect(remaining).toHaveLength(1);
    expect(output.stdout.join("\n")).toContain("Dry-run mode");
  });
});
