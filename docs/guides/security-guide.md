# Security Guide

- Prefer signed transport boundaries and strict ACL rules.
- Use JWT/HMAC mechanisms from `@conduit/core` security package.
- Enforce deny-by-default ACL policy.
- Never trust `source_service` without authentication.
