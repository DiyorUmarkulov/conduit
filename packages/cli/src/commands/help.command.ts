import { colors } from "../output/colors.js";
import type { CliOutput } from "../types.js";

export const printHelp = (output: CliOutput): void => {
  output.write(colors.bold("Conduit CLI"));
  output.write("");
  output.write("Usage:");
  output.write("  conduit init [--path <path>] [--force]");
  output.write("  conduit routes list [--config <path>] [--json]");
  output.write(
    "  conduit dlq inspect [--config <path>] [--operation-name <name>] [--handler-id <id>] [--limit <n>] [--json]"
  );
  output.write(
    "  conduit dlq replay --id <entry-id> [--config <path>] [--keep] [--dry-run]"
  );
  output.write("  conduit schema validate --file <path> [--json]");
  output.write("  conduit schema diff --left <path> --right <path> [--json]");
  output.write(
    "  conduit migrate [--dialect postgres|mysql|sqlite] [--out <path>] [--print]"
  );
  output.write("");
  output.write("Global flags:");
  output.write("  --help");
};
