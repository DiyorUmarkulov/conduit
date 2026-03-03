import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseMigrateDialect,
  runMigrateCommand
} from "../../src/commands/migrate.command.js";

const createOutput = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    io: {
      write: (message: string) => {
        stdout.push(message);
      },
      error: (message: string) => {
        stderr.push(message);
      }
    }
  };
};

describe("migrate command", () => {
  it("writes sqlite migration file", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conduit-migrate-"));
    const outFile = join(cwd, "migrations", "outbox.sql");
    const output = createOutput();

    const status = await runMigrateCommand({
      output: output.io,
      dialect: "sqlite",
      out_file: outFile,
      print: false
    });

    const written = await readFile(outFile, "utf8");

    expect(status).toBe(0);
    expect(written).toContain("CREATE TABLE IF NOT EXISTS conduit_outbox");
    expect(written).toContain("conduit_outbox_dlq");
  });

  it("validates dialect", () => {
    expect(() => parseMigrateDialect("oracle")).toThrowError("Invalid --dialect value");
    expect(parseMigrateDialect("postgres")).toBe("postgres");
  });
});
