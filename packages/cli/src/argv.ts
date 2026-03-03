import type { ParsedArgs } from "./types.js";

const isFlag = (token: string): boolean => token.startsWith("--");

export const parseArgs = (argv: string[]): ParsedArgs => {
  const args = [...argv];

  const command = args.shift();
  const subcommand = args.shift();

  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === undefined) {
      continue;
    }

    if (!isFlag(token)) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = args[index + 1];

    if (!next || isFlag(next)) {
      flags.set(key, true);
      continue;
    }

    flags.set(key, next);
    index += 1;
  }

  return {
    command,
    subcommand,
    positionals,
    flags
  };
};

export const requireStringFlag = (
  flags: Map<string, string | boolean>,
  key: string
): string => {
  const value = flags.get(key);

  if (typeof value === "string") {
    return value;
  }

  throw new Error(`Missing required flag --${key}`);
};

export const optionalStringFlag = (
  flags: Map<string, string | boolean>,
  key: string
): string | undefined => {
  const value = flags.get(key);

  if (typeof value === "string") {
    return value;
  }

  return undefined;
};

export const booleanFlag = (
  flags: Map<string, string | boolean>,
  key: string
): boolean => flags.get(key) === true;

export const optionalNumberFlag = (
  flags: Map<string, string | boolean>,
  key: string
): number | undefined => {
  const value = flags.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for --${key}: ${value}`);
  }

  return parsed;
};
