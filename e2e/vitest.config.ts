import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@conduit/core": resolve(currentDir, "../packages/core/src/index.ts"),
      "@conduit/provider-inmemory": resolve(
        currentDir,
        "../packages/provider-inmemory/src/index.ts"
      ),
      "@conduit/provider-outbox": resolve(
        currentDir,
        "../packages/provider-outbox/src/index.ts"
      )
    }
  },
  test: {
    root: currentDir,
    include: ["scenarios/**/*.e2e.ts"],
    testTimeout: 60_000
  }
});
