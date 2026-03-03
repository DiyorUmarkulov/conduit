import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/express/vitest.config.ts",
  "packages/nestjs/vitest.config.ts",
  "packages/provider-kafka/vitest.config.ts",
  "packages/core/vitest.config.ts",
  "packages/provider-inmemory/vitest.config.ts",
  "packages/provider-nats/vitest.config.ts",
  "packages/provider-outbox/vitest.config.ts",
  "packages/provider-rabbitmq/vitest.config.ts",
  "packages/schema-registry/vitest.config.ts",
  "packages/testing/vitest.config.ts",
  "packages/cli/vitest.config.ts"
]);
