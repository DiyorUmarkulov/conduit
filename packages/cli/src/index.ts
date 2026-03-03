#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { printHelp } from "./commands/help.command.js";
import { runDlqInspectCommand } from "./commands/dlq-inspect.command.js";
import { runDlqReplayCommand } from "./commands/dlq-replay.command.js";
import { runInitCommand } from "./commands/init.command.js";
import {
  parseMigrateDialect,
  runMigrateCommand
} from "./commands/migrate.command.js";
import { runRouteListCommand } from "./commands/route-list.command.js";
import { runSchemaDiffCommand } from "./commands/schema-diff.command.js";
import { runSchemaValidateCommand } from "./commands/schema-validate.command.js";
import {
  booleanFlag,
  optionalNumberFlag,
  optionalStringFlag,
  parseArgs,
  requireStringFlag
} from "./argv.js";
import {
  loadConfig,
  resolveConfigPath,
  resolveDlqManager,
  resolveRoutes
} from "./config-loader.js";
import type { CliOutput } from "./types.js";

const output: CliOutput = {
  write: (message: string) => {
    process.stdout.write(`${message}\n`);
  },
  error: (message: string) => {
    process.stderr.write(`${message}\n`);
  }
};

export const runCli = async (
  argv: string[],
  io: CliOutput = output,
  cwd = process.cwd()
): Promise<number> => {
  const parsed = parseArgs(argv);

  if (!parsed.command || booleanFlag(parsed.flags, "help")) {
    printHelp(io);
    return 0;
  }

  if (parsed.command === "init") {
    const path = optionalStringFlag(parsed.flags, "path");

    return runInitCommand({
      output: io,
      cwd,
      ...(path ? { path } : {}),
      force: booleanFlag(parsed.flags, "force")
    });
  }

  if (parsed.command === "schema" && parsed.subcommand === "validate") {
    const filePath = requireStringFlag(parsed.flags, "file");

    return runSchemaValidateCommand({
      file_path: filePath,
      output: io,
      cwd,
      json: booleanFlag(parsed.flags, "json")
    });
  }

  if (parsed.command === "schema" && parsed.subcommand === "diff") {
    const leftFile =
      optionalStringFlag(parsed.flags, "left") ?? parsed.positionals[0];
    const rightFile =
      optionalStringFlag(parsed.flags, "right") ?? parsed.positionals[1];

    if (!leftFile || !rightFile) {
      io.error("Schema diff requires two files: --left <path> --right <path>");
      return 1;
    }

    return runSchemaDiffCommand({
      left_file: leftFile,
      right_file: rightFile,
      output: io,
      cwd,
      json: booleanFlag(parsed.flags, "json")
    });
  }

  if (parsed.command === "migrate") {
    const dialectRaw = optionalStringFlag(parsed.flags, "dialect");
    const dialect = dialectRaw ? parseMigrateDialect(dialectRaw) : "postgres";
    const outFile = optionalStringFlag(parsed.flags, "out");

    return runMigrateCommand({
      output: io,
      cwd,
      dialect,
      ...(outFile ? { out_file: outFile } : {}),
      print: booleanFlag(parsed.flags, "print")
    });
  }

  if (parsed.command !== "routes" && parsed.command !== "dlq") {
    io.error(
      `Unknown command: ${parsed.command}${parsed.subcommand ? ` ${parsed.subcommand}` : ""}`
    );
    printHelp(io);
    return 1;
  }

  const configPath = await resolveConfigPath(
    optionalStringFlag(parsed.flags, "config"),
    cwd
  );
  const config = await loadConfig(configPath);

  if (parsed.command === "routes" && parsed.subcommand === "list") {
    const routes = await resolveRoutes(config);

    runRouteListCommand({
      routes,
      json: booleanFlag(parsed.flags, "json"),
      output: io
    });

    return 0;
  }

  if (parsed.command === "dlq" && parsed.subcommand === "inspect") {
    const dlqManager = await resolveDlqManager(config);

    if (!dlqManager) {
      io.error("DLQ manager is not configured");
      return 1;
    }

    const operationName = optionalStringFlag(parsed.flags, "operation-name");
    const handlerId = optionalStringFlag(parsed.flags, "handler-id");
    const limit = optionalNumberFlag(parsed.flags, "limit");

    const filter = {
      ...(operationName ? { operation_name: operationName } : {}),
      ...(handlerId ? { handler_id: handlerId } : {})
    };

    const entries = await dlqManager.list(filter);

    const commandInput = {
      entries,
      filter,
      json: booleanFlag(parsed.flags, "json"),
      output: io
    };

    if (limit !== undefined) {
      runDlqInspectCommand({
        ...commandInput,
        limit
      });
    } else {
      runDlqInspectCommand(commandInput);
    }

    return 0;
  }

  if (parsed.command === "dlq" && parsed.subcommand === "replay") {
    const entryId = requireStringFlag(parsed.flags, "id");

    return runDlqReplayCommand({
      config,
      entry_id: entryId,
      keep: booleanFlag(parsed.flags, "keep"),
      dry_run: booleanFlag(parsed.flags, "dry-run"),
      output: io
    });
  }

  io.error(
    `Unknown command: ${parsed.command}${parsed.subcommand ? ` ${parsed.subcommand}` : ""}`
  );
  printHelp(io);
  return 1;
};

const isExecutedDirectly = (() => {
  const scriptPath = process.argv[1];

  if (!scriptPath) {
    return false;
  }

  return import.meta.url === pathToFileURL(scriptPath).href;
})();

if (isExecutedDirectly) {
  runCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      output.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
