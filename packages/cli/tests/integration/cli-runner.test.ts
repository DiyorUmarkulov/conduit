import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../../src/index.js";

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

describe("runCli integration", () => {
  it("initializes config without existing file", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "conduit-cli-init-"));
    const output = createOutput();

    const status = await runCli(["init"], output.io, workdir);

    expect(status).toBe(0);
    expect(output.stdout.join("\n")).toContain("Created");
  });

  it("lists routes from config file", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "conduit-cli-"));
    const configPath = join(workdir, "conduit.config.js");

    await writeFile(
      configPath,
      `export default {
  routes: [
    {
      operation_name: "order.create",
      operation_type: "COMMAND",
      provider: "OUTBOX",
      on_exhausted: "DLQ"
    }
  ]
};\n`,
      "utf8"
    );

    const output = createOutput();

    const status = await runCli([
      "routes",
      "list",
      "--config",
      configPath
    ], output.io, workdir);

    expect(status).toBe(0);
    expect(output.stdout.join("\n")).toContain("order.create");
    expect(output.stderr).toHaveLength(0);
  });
});
