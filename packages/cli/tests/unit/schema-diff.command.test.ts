import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runSchemaDiffCommand } from "../../src/commands/schema-diff.command.js";

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

describe("schema diff command", () => {
  it("shows added and changed fields", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conduit-schema-diff-"));
    const leftPath = join(cwd, "left.json");
    const rightPath = join(cwd, "right.json");
    const output = createOutput();

    await writeFile(leftPath, JSON.stringify({ a: 1, nested: { b: true } }), "utf8");
    await writeFile(
      rightPath,
      JSON.stringify({ a: 2, nested: { b: true, c: "x" } }),
      "utf8"
    );

    const status = await runSchemaDiffCommand({
      left_file: leftPath,
      right_file: rightPath,
      output: output.io
    });

    expect(status).toBe(0);
    expect(output.stdout.join("\n")).toContain("nested.c");
    expect(output.stdout.join("\n")).toContain("Changed values:");
    expect(output.stdout.join("\n")).toContain("a");
  });
});
