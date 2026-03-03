import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EnvelopeBuilder } from "@conduit/core";

import { runSchemaValidateCommand } from "../../src/commands/schema-validate.command.js";

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

describe("schema validate command", () => {
  it("returns success for valid envelope", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conduit-schema-validate-"));
    const filePath = join(cwd, "envelope.json");
    const output = createOutput();

    const envelope = EnvelopeBuilder.command("order.create", { order_id: "o-1" })
      .withSourceService("api-gateway")
      .withIdempotencyKey("idem-1")
      .build();

    await writeFile(filePath, JSON.stringify(envelope, null, 2), "utf8");

    const status = await runSchemaValidateCommand({
      file_path: filePath,
      output: output.io
    });

    expect(status).toBe(0);
    expect(output.stdout.join("\n")).toContain("Schema is valid");
  });

  it("returns failure for invalid envelope", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conduit-schema-validate-"));
    const filePath = join(cwd, "invalid.json");
    const output = createOutput();

    await writeFile(filePath, JSON.stringify({ foo: "bar" }), "utf8");

    const status = await runSchemaValidateCommand({
      file_path: filePath,
      output: output.io
    });

    expect(status).toBe(1);
    expect(output.stderr.join("\n")).toContain("Schema validation failed");
  });
});
