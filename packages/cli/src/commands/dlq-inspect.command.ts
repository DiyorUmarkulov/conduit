import { renderTable } from "../output/table.js";
import { colors } from "../output/colors.js";
import type { CliOutput } from "../types.js";
import type { DLQEntry, DLQFilter } from "@conduit/core";

export interface DlqInspectCommandInput {
  entries: DLQEntry[];
  filter: DLQFilter;
  json?: boolean;
  limit?: number;
  output: CliOutput;
}

export const runDlqInspectCommand = ({
  entries,
  filter,
  json,
  limit,
  output
}: DlqInspectCommandInput): void => {
  const bounded = entries.slice(0, Math.max(1, limit ?? entries.length));

  if (json) {
    output.write(
      JSON.stringify(
        {
          filter,
          count: bounded.length,
          entries: bounded
        },
        null,
        2
      )
    );
    return;
  }

  if (bounded.length === 0) {
    output.write(colors.yellow("DLQ is empty for the provided filter"));
    return;
  }

  const table = renderTable(
    [
      { key: "id", header: "Entry ID", width: 36 },
      { key: "operation_name", header: "Operation" },
      { key: "handler_id", header: "Handler" },
      { key: "attempts", header: "Attempts" },
      { key: "last_error", header: "Last Error", width: 60 },
      { key: "created_at", header: "Created At", width: 24 }
    ],
    bounded.map((entry) => ({
      id: entry.id,
      operation_name: entry.envelope.operation_name,
      handler_id: entry.handler_id,
      attempts: entry.attempts,
      last_error: entry.last_error,
      created_at: entry.created_at
    }))
  );

  output.write(table);
  output.write("");
  output.write(colors.cyan(`Displayed DLQ entries: ${bounded.length}`));
};
