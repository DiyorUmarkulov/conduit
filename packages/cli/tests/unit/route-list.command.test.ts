import { describe, expect, it } from "vitest";

import { runRouteListCommand } from "../../src/commands/route-list.command.js";

const createOutput = () => {
  const lines: string[] = [];

  return {
    lines,
    io: {
      write: (message: string) => {
        lines.push(message);
      },
      error: (_message: string) => {
        lines.push("ERROR");
      }
    }
  };
};

describe("route list command", () => {
  it("renders table output", () => {
    const sink = createOutput();

    runRouteListCommand({
      routes: [
        {
          operation_name: "order.create",
          operation_type: "COMMAND",
          provider: "OUTBOX",
          on_exhausted: "DLQ"
        }
      ],
      output: sink.io
    });

    expect(sink.lines.join("\n")).toContain("order.create");
    expect(sink.lines.join("\n")).toContain("OUTBOX");
  });

  it("renders json when requested", () => {
    const sink = createOutput();

    runRouteListCommand({
      routes: [
        {
          operation_name: "payment.charge",
          operation_type: "COMMAND",
          provider: "OUTBOX",
          on_exhausted: "DLQ"
        }
      ],
      json: true,
      output: sink.io
    });

    expect(sink.lines[0]).toContain("payment.charge");
  });
});
