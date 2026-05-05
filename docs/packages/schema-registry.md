---
description: Schema registry client, Avro/JSON validation, and compatibility checks (@theconduit/schema-registry).
---

# Schema registry

**npm:** `@theconduit/schema-registry`

**Confluent-style** registry over HTTP, a **local** in-memory registry for tests, **Avro / JSON schema** validation, and **semver-oriented** compatibility + **diff** — used by the **Kafka** package (Avro) and **`conduit schema`** CLI commands.

## When it helps

- **CI**: fail builds when a new Avro schema is incompatible with the previous version.
- **Tests**: no network — use `LocalSchemaRegistry` and assert `checkCompatibility` / `diffSchemas`.

## Minimal example (local registry + compatibility)

```ts
import {
  checkCompatibility,
  LocalSchemaRegistry,
  diffSchemas
} from "@theconduit/schema-registry";

const registry = new LocalSchemaRegistry();

await registry.register({
  subject: "orders-value",
  format: "AVRO",
  schema: JSON.stringify({
    type: "record",
    name: "Order",
    fields: [{ name: "id", type: "string" }]
  })
});

const previousJsonSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string" } }
};

const nextJsonSchema = {
  type: "object",
  required: [],
  properties: {}
};

const compat = checkCompatibility(previousJsonSchema, nextJsonSchema, "BACKWARD");
// compat.compatible === false — required field "id" was dropped

const drift = diffSchemas(
  { type: "record", name: "Order", fields: [{ name: "id", type: "string" }] },
  { type: "record", name: "Order", fields: [{ name: "id", type: "int" }] }
);
```

For **Confluent Schema Registry**, construct `ConfluentSchemaRegistry` with your own `HttpClient` (base URL + auth headers).

## Install

```bash
pnpm add @theconduit/schema-registry
```

## Exports (overview)

| Area | Symbols |
| --- | --- |
| Registry API | `ISchemaRegistry`, `RegisterSchemaInput`, `RegisteredSchema`, `SchemaFormat` |
| Remote | `ConfluentSchemaRegistry` (injectable `HttpClient`) |
| Local | `LocalSchemaRegistry` |
| Validation | `validateJsonSchema`, … |
| Compatibility | `checkCompatibility`, `COMPATIBILITY_MODES`, `diffSchemas` |

## Formats

Supports **AVRO**, **JSON_SCHEMA** (mapped for Confluent API), and **PROTOBUF** type mapping in the Confluent client.

## Further reading

- [Versioning & schemas](../guides/versioning-guide)
- [Kafka transport](./provider-kafka)
- [CLI (npm package)](./cli)
