import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { CliOutput } from "../types.js";

export interface InitCommandInput {
  output: CliOutput;
  cwd?: string;
  path?: string;
  force?: boolean;
}

const DEFAULT_TEMPLATE = `export default {
  routes: [],
  dlq_manager: undefined,
  dispatch: undefined
};
`;

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const runInitCommand = async ({
  output,
  cwd = process.cwd(),
  path,
  force = false
}: InitCommandInput): Promise<number> => {
  const targetPath = resolve(cwd, path ?? "conduit.config.js");

  if (!force && (await fileExists(targetPath))) {
    output.error(`Config file already exists: ${targetPath}. Use --force to overwrite.`);
    return 1;
  }

  await mkdir(dirname(targetPath), {
    recursive: true
  });
  await writeFile(targetPath, DEFAULT_TEMPLATE, "utf8");

  output.write(`Created ${targetPath}`);
  return 0;
};
