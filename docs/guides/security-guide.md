# Security Guide

Conduit security is built from explicit authentication, ACL policy, and strict handler boundaries.

## 1. Authenticate envelope source

Core package provides mechanisms:

- `HmacAuthMechanism`
- `JwtAuthMechanism`
- `NoopAuthMechanism` (dev/test only)

Use custom middleware to authenticate before dispatch reaches provider:

```ts
import {
  ConduitBuilder,
  HmacAuthMechanism,
  ACLBuilder,
  ACLEvaluator,
  createAuthorizationMiddleware
} from "@conduit/core";

const hmac = new HmacAuthMechanism({
  secret_resolver: (sourceService) => secrets[sourceService],
  header_name: "x-conduit-signature"
});

const aclBuilder = new ACLBuilder();
aclBuilder.add(aclBuilder.allow("api-gateway").to("order.*", "COMMAND"));
aclBuilder.denyAll();
const acl = new ACLEvaluator(aclBuilder.build());

const builder = new ConduitBuilder();

builder.use(async (context, next) => {
  hmac.authenticate(context.envelope);
  await next();
});

builder.use(createAuthorizationMiddleware({ evaluator: acl }));
```

## 2. Enforce deny-by-default ACL

- Start from `denyAll()`.
- Add minimal `allow(...)` rules.
- Use operation patterns carefully (`order.*` only where justified).

## 3. Trust boundaries

- Never trust `source_service` without authentication.
- Normalize and verify security headers at ingress.
- Keep secrets/keys in vault-managed configuration, not code.

## 4. JWT notes

When using `JwtAuthMechanism`, configure expected issuer/audience and key material explicitly.

## 5. Operational checks

- Alert on authorization failures spikes.
- Rotate HMAC/JWT keys with overlap window.
- Audit ACL changes like code changes.
