# Contributing

## Prerequisites

- Node.js 20+
- PNPM 9+

## Development flow

1. Install dependencies: `pnpm install`
2. Run checks before commit:
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
3. Use conventional commit messages when possible.

## Architecture guardrails

- Keep `COMMAND` and `EVENT` semantics explicit.
- Never hide transport guarantees behind misleading abstractions.
- Preserve at-least-once + idempotency model as a contract.
