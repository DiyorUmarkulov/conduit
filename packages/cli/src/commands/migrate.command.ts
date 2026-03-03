import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { OUTBOX_SQL_MIGRATIONS, type OutboxSqlDialect } from "@conduit/provider-outbox";

import type { CliOutput } from "../types.js";

export interface MigrateCommandInput {
  output: CliOutput;
  dialect?: OutboxSqlDialect;
  out_file?: string;
  print?: boolean;
  cwd?: string;
}

const asDialect = (value: string | undefined): OutboxSqlDialect | undefined => {
  if (!value) {
    return undefined;
  }

  if (value === "postgres" || value === "mysql" || value === "sqlite") {
    return value;
  }

  return undefined;
};

export const runMigrateCommand = async ({
  output,
  dialect = "postgres",
  out_file: outFile,
  print = false,
  cwd = process.cwd()
}: MigrateCommandInput): Promise<number> => {
  const migrations = OUTBOX_SQL_MIGRATIONS[dialect];

  if (!migrations) {
    output.error(`Unsupported dialect: ${dialect}`);
    return 1;
  }

  const script = `${migrations.join("\n\n")}\n`;

  if (print || !outFile) {
    output.write(script);
  }

  if (outFile) {
    const absolutePath = resolve(cwd, outFile);
    await mkdir(dirname(absolutePath), {
      recursive: true
    });
    await writeFile(absolutePath, script, "utf8");
    output.write(`Migration written: ${absolutePath}`);
  }

  return 0;
};

export const parseMigrateDialect = (value: string | undefined): OutboxSqlDialect => {
  const dialect = asDialect(value);

  if (!dialect) {
    throw new Error(
      `Invalid --dialect value: ${value ?? "<empty>"}. Expected postgres|mysql|sqlite`
    );
  }

  return dialect;
};
