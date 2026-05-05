---
description: Official conduit CLI for routes, DLQ, schemas, and outbox migrations (@theconduit/cli).
---

# CLI (npm package)

**npm:** `@theconduit/cli` · binary **`conduit`**

Inspect routes, run **outbox SQL migrations**, **DLQ** inspect/replay, and **Avro/schema** validate or diff — for operators and CI.

## When it helps

- **On-call**: inspect DLQ, replay a poison message after a fix.
- **CI**: validate schema files and fail builds on incompatible changes.
- **Bootstrap**: generate outbox DDL for Postgres/MySQL/SQLite without copying SQL by hand.

## Minimal examples

Install and print help:

```bash
pnpm add -D @theconduit/cli
pnpm exec conduit --help
```

Typical checks in a repo that has `conduit.config.js`:

```bash
pnpm exec conduit routes list --json
pnpm exec conduit schema validate --file ./schemas/order.avsc
pnpm exec conduit migrate --dialect postgres --print
```

Inspect DLQ (filters optional):

```bash
pnpm exec conduit dlq inspect --operation-name order.create --limit 20
```

Replay one entry after fixing the handler:

```bash
pnpm exec conduit dlq replay --id <entry-id> --dry-run
pnpm exec conduit dlq replay --id <entry-id>
```

## Install

```bash
pnpm add -D @theconduit/cli
pnpm exec conduit --help
```

The binary name is **`conduit`** (`package.json` → `bin.conduit`).

## Commands

| Command | Purpose |
| --- | --- |
| `conduit init [--path <path>] [--force]` | Scaffold starter config / layout |
| `conduit routes list [--config <path>] [--json]` | List resolved routes |
| `conduit dlq inspect ...` | Inspect DLQ entries (filters: `operation-name`, `handler-id`, `limit`) |
| `conduit dlq replay --id <entry-id> ...` | Replay one entry (`--keep`, `--dry-run`) |
| `conduit schema validate --file <path> [--json]` | Validate schema file |
| `conduit schema diff --left <path> --right <path> [--json]` | Compare two schemas |
| `conduit migrate [--dialect postgres\|mysql\|sqlite] [--out <path>] [--print]` | Emit or print SQL migrations for outbox tables |

Global flag: `--help`.

## Dependencies

- **`@theconduit/core`**: shared types and route loading where applicable.
- **`@theconduit/provider-outbox`**: migration assets and outbox-oriented helpers.

Programmatic entry: `runCli(argv, io?, cwd?)` from the package root (for tests or custom wrappers).

## Further reading

- [CLI how-to](../guides/cli)
- [SQL outbox package](./provider-outbox) (migrations)
- [Schema registry](./schema-registry) (validate/diff semantics)
