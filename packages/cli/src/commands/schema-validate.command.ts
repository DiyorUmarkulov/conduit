import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateEnvelope, type OperationEnvelope } from "@conduit/core";

import type { CliOutput } from "../types.js";

export interface SchemaValidateCommandInput {
  file_path: string;
  output: CliOutput;
  cwd?: string;
  json?: boolean;
}

export const runSchemaValidateCommand = async ({
  file_path: filePath,
  output,
  cwd = process.cwd(),
  json = false
}: SchemaValidateCommandInput): Promise<number> => {
  const absolutePath = resolve(cwd, filePath);

  try {
    const raw = await readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw) as OperationEnvelope;
    validateEnvelope(parsed);

    if (json) {
      output.write(
        JSON.stringify(
          {
            valid: true,
            file: absolutePath
          },
          null,
          2
        )
      );
    } else {
      output.write(`Schema is valid: ${absolutePath}`);
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (json) {
      output.write(
        JSON.stringify(
          {
            valid: false,
            file: absolutePath,
            error: message
          },
          null,
          2
        )
      );
    } else {
      output.error(`Schema validation failed for ${absolutePath}: ${message}`);
    }

    return 1;
  }
};
