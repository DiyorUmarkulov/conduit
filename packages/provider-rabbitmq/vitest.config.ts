import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@conduit/core": resolve(currentDir, "../core/src/index.ts")
    }
  },
  test: {
    include: ["tests/**/*.test.ts"]
  }
});
