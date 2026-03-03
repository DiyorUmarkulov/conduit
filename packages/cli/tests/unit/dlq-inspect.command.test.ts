import { describe, expect, it } from "vitest";

import { asOperationName, type DLQEntry } from "@conduit/core";

import { runDlqInspectCommand } from "../../src/commands/dlq-inspect.command.js";

const createOutput = () => {
  const lines: string[] = [];

  return {
    lines,
    io: {
      write: (message: string) => {
        lines.push(message);
      },
      error: (message: string) => {
        lines.push(`ERR:${message}`);
      }
    }
  };
};

const sampleEntry: DLQEntry = {
  id: "entry-1",
  envelope: {
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
  },
  route: {
    operation_name: "order.create",
    operation_type: "COMMAND",
    provider: "OUTBOX",
    on_exhausted: "DLQ"
  },
  handler_id: "handler-1",
  attempts: 3,
  last_error: "Error: failed",
  created_at: "2026-01-01T00:00:10.000Z",
  attempt_history: [
    {
      attempt_number: 3,
      failed_at: "2026-01-01T00:00:10.000Z",
      error: "Error: failed"
    }
  ]
};

describe("dlq inspect command", () => {
  it("renders table output", () => {
    const sink = createOutput();

    runDlqInspectCommand({
      entries: [sampleEntry],
      filter: {},
      output: sink.io
    });

    expect(sink.lines.join("\n")).toContain("entry-1");
    expect(sink.lines.join("\n")).toContain("order.create");
  });

  it("renders json output", () => {
    const sink = createOutput();

    runDlqInspectCommand({
      entries: [sampleEntry],
      filter: { operation_name: "order.create" },
      json: true,
      output: sink.io
    });

    expect(sink.lines[0]).toContain("operation_name");
  });
});
