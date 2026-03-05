# @theconduit/schema-registry

Schema registry abstractions, compatibility checks, diffs, and JSON schema validation helpers.

## Install

```bash
pnpm add @theconduit/schema-registry
```

## Highlights

- `LocalSchemaRegistry` for local/in-memory schema versioning.
- `ConfluentSchemaRegistry` adapter over HTTP client abstraction.
- Compatibility checks via `checkCompatibility`.
- Schema diffs via `diffSchemas`.
- Lightweight JSON schema payload validation via `validateJsonSchema`.

## Quick start

```ts
import {
  LocalSchemaRegistry,
  checkCompatibility,
  diffSchemas,
  validateJsonSchema
} from "@theconduit/schema-registry";

const registry = new LocalSchemaRegistry();

await registry.register({
  subject: "order.create",
  format: "JSON_SCHEMA",
  schema: {
    type: "object",
    required: ["order_id"],
    properties: {
      order_id: { type: "string" },
      total: { type: "number" }
    }
  }
});

const latest = await registry.getLatest("order.create");

const compatibility = checkCompatibility(
  { required: ["order_id"] },
  { required: ["order_id", "currency"] },
  "FULL"
);

const diff = diffSchemas(
  { properties: { total: { type: "number" } } },
  { properties: { total: { type: "string" }, currency: { type: "string" } } }
);

const validation = validateJsonSchema(latest?.schema, {
  order_id: "o-1",
  total: 100
});
```

## Exports

- Registries: `LocalSchemaRegistry`, `ConfluentSchemaRegistry`
- Interfaces/types: `ISchemaRegistry`, `RegisteredSchema`, `SchemaFormat`
- Utilities: `checkCompatibility`, `diffSchemas`, `validateJsonSchema`

## Related docs

- `docs/guides/versioning-guide.md`
- `docs/guides/cli.md`
