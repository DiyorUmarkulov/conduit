import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { ConduitCliConfig } from "./types.js";

const DEFAULT_CONFIG_CANDIDATES = [
  "conduit.config.js",
  "conduit.config.mjs",
  "conduit.config.cjs",
  "conduit.config.json",
  "conduit.config.ts"
] as const;

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const toConfig = (value: unknown): ConduitCliConfig => {
  if (!value || typeof value !== "object") {
    throw new Error("Config must export an object");
  }

  return value as ConduitCliConfig;
};

export const resolveConfigPath = async (
  inputPath: string | undefined,
  cwd = process.cwd()
): Promise<string> => {
  if (inputPath) {
    const resolved = resolve(cwd, inputPath);

    if (!(await exists(resolved))) {
      throw new Error(`Config file not found: ${resolved}`);
    }

    return resolved;
  }

  for (const candidate of DEFAULT_CONFIG_CANDIDATES) {
    const resolved = resolve(cwd, candidate);

    if (await exists(resolved)) {
      return resolved;
    }
  }

  throw new Error(
    `Config file not found. Checked: ${DEFAULT_CONFIG_CANDIDATES.join(", ")}`
  );
};

export const loadConfig = async (
  path: string
): Promise<ConduitCliConfig> => {
  if (path.endsWith(".ts")) {
    throw new Error(
      "TypeScript config is not directly executable by Node. Use conduit.config.js/.mjs or precompile TS config."
    );
  }

  if (path.endsWith(".json")) {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return toConfig(parsed);
  }

  const moduleNs = (await import(pathToFileURL(path).href)) as {
    default?: unknown;
  };

  const value = moduleNs.default ?? moduleNs;
  return toConfig(value);
};

export const resolveRoutes = async (
  config: ConduitCliConfig
): Promise<import("@conduit/core").RouteConfig[]> => {
  if (!config.routes) {
    return [];
  }

  if (typeof config.routes === "function") {
    return Promise.resolve(config.routes());
  }

  return config.routes;
};

export const resolveDlqManager = async (
  config: ConduitCliConfig
): Promise<import("@conduit/core").IDLQManager | undefined> => {
  if (!config.dlq_manager) {
    return undefined;
  }

  if (typeof config.dlq_manager === "function") {
    return Promise.resolve(config.dlq_manager());
  }

  return config.dlq_manager;
};
