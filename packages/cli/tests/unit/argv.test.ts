import { describe, expect, it } from "vitest";

import {
  booleanFlag,
  optionalNumberFlag,
  optionalStringFlag,
  parseArgs,
  requireStringFlag
} from "../../src/argv.js";

describe("argv parser", () => {
  it("parses command, subcommand, and flags", () => {
    const parsed = parseArgs([
      "dlq",
      "inspect",
      "--config",
      "conduit.config.js",
      "--json",
      "--limit",
      "10"
    ]);

    expect(parsed.command).toBe("dlq");
    expect(parsed.subcommand).toBe("inspect");
    expect(optionalStringFlag(parsed.flags, "config")).toBe("conduit.config.js");
    expect(booleanFlag(parsed.flags, "json")).toBe(true);
    expect(optionalNumberFlag(parsed.flags, "limit")).toBe(10);
  });

  it("throws on missing required flag", () => {
    const parsed = parseArgs(["dlq", "replay"]);

    expect(() => requireStringFlag(parsed.flags, "id")).toThrowError(
      "Missing required flag --id"
    );
  });
});
