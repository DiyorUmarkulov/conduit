import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

/** Explicit sidebar labels (avoid raw `@theconduit/...` and Title-Case file names). */
const doc = (id: string, label: string) => ({ type: "doc" as const, id, label });

const sidebars: SidebarsConfig = {
  main: [
    {
      type: "category",
      label: "Learn",
      link: { type: "doc", id: "guides/how-conduit-works" },
      items: [
        doc("packages/index", "Package map"),
        doc("guides/how-conduit-works", "How it works"),
        doc("guides/getting-started", "Getting started"),
        doc("guides/choosing-provider", "Choosing a transport")
      ]
    },
    {
      type: "category",
      label: "Libraries & local dev",
      items: [
        doc("packages/core", "Core library"),
        doc("packages/cli", "CLI (npm package)"),
        doc("guides/cli", "CLI how-to"),
        doc("packages/testing", "Test helpers"),
        doc("packages/provider-inmemory", "In-memory transport")
      ]
    },
    {
      type: "category",
      label: "Production guides",
      items: [
        doc("guides/transport-hardening", "Timeouts & resilience"),
        doc("guides/security-guide", "Security"),
        doc("guides/versioning-guide", "Versioning & schemas"),
        doc("guides/idempotency-patterns", "Idempotency"),
        doc("guides/migration-monolith-to-services", "Splitting a monolith")
      ]
    },
    {
      type: "category",
      label: "Outbox",
      items: [
        doc("guides/outbox-provider", "Transactional outbox"),
        doc("packages/provider-outbox", "SQL outbox package"),
        doc("architecture/decisions/outbox-skip-locked", "ADR: SKIP LOCKED")
      ]
    },
    {
      type: "category",
      label: "Kafka",
      items: [
        doc("packages/provider-kafka", "Kafka transport"),
        doc("packages/schema-registry", "Schema registry")
      ]
    },
    {
      type: "category",
      label: "RabbitMQ",
      items: [doc("packages/provider-rabbitmq", "RabbitMQ transport")]
    },
    {
      type: "category",
      label: "NATS",
      items: [doc("packages/provider-nats", "NATS transport")]
    },
    {
      type: "category",
      label: "Framework integrations",
      items: [
        doc("packages/nestjs", "NestJS"),
        doc("packages/express", "Express")
      ]
    },
    {
      type: "category",
      label: "Architecture decisions",
      items: [
        doc("architecture/decisions/monorepo-structure", "Monorepo layout"),
        doc("architecture/decisions/no-query-in-conduit", "No query bus"),
        doc("architecture/decisions/at-least-once-contract", "At-least-once"),
        doc("architecture/decisions/semver-routing", "Semver routing")
      ]
    }
  ]
};

export default sidebars;
