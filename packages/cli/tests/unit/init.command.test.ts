import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runInitCommand } from "../../src/commands/init.command.js";

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

describe("init command", () => {
  it("creates conduit config file", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conduit-init-"));
    const output = createOutput();

    const status = await runInitCommand({
      output: output.io,
      cwd
    });

    const created = await readFile(join(cwd, "conduit.config.js"), "utf8");

    expect(status).toBe(0);
    expect(created).toContain("export default");
    expect(output.stderr).toHaveLength(0);
  });

  it("fails when config exists without --force", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conduit-init-"));
    const output = createOutput();

    await runInitCommand({
      output: output.io,
      cwd
    });

    const secondStatus = await runInitCommand({
      output: output.io,
      cwd
    });

    expect(secondStatus).toBe(1);
    expect(output.stderr.join("\n")).toContain("already exists");
  });
});
