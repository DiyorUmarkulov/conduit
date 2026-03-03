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
      "@conduit/provider-kafka": resolve(
        currentDir,
        "../packages/provider-kafka/src/index.ts"
      ),
      "@conduit/provider-rabbitmq": resolve(
        currentDir,
        "../packages/provider-rabbitmq/src/index.ts"
      ),
      "@conduit/provider-nats": resolve(
        currentDir,
        "../packages/provider-nats/src/index.ts"
      ),
      "@conduit/provider-outbox": resolve(
        currentDir,
        "../packages/provider-outbox/src/index.ts"
      )
    }
  },
  test: {
    root: currentDir,
    globalSetup: [resolve(currentDir, "infrastructure/global-setup.ts")],
    fileParallelism: false,
    include: ["scenarios/**/*.e2e.ts"],
    testTimeout: 60_000
  }
});
