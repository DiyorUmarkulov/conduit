import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/core/vitest.config.ts",
  "packages/provider-inmemory/vitest.config.ts",
  "packages/provider-outbox/vitest.config.ts",
  "packages/cli/vitest.config.ts"
]);
