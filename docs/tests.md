---
title: tests
layout: default
nav_order: 3
---

[← Home](index.md) | **tests**

# tests

> End-to-end payment tests and endpoint validation.

## Contents

| Item | Purpose |
|------|---------|
| [`endpoint-registry.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/endpoint-registry.ts) | **Source of truth** for endpoint counts and test configs |
| [`_run_all_tests.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/_run_all_tests.ts) | E2E payment test runner for all endpoints |
| [`_shared_utils.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/_shared_utils.ts) | Shared test utilities and error parsing |
| [`_test_generator.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/_test_generator.ts) | Test types and X402 V2 payment flow test factory |
| [`_validate_endpoints.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/_validate_endpoints.ts) | Endpoint count validation |
| [`info-endpoints.test.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/info-endpoints.test.ts) | Free info endpoint tests |
| [`registry-lifecycle.test.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/registry-lifecycle.test.ts) | Registry CRUD lifecycle tests |
| [`links-lifecycle.test.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/links-lifecycle.test.ts) | Links CRUD lifecycle tests |
| [`agent-registry.test.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/agent-registry.test.ts) | Agent registry tests |
| [`bazaar.test.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/bazaar.test.ts) | Bazaar metadata tests |
| [`ssrf-protection.test.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/ssrf-protection.test.ts) | SSRF protection tests |
| [`admin-verify.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/admin-verify.ts) | Admin registry verification script |
| [`registry-manage.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/registry-manage.ts) | User endpoint management script |
| [`check-setup.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/check-setup.ts) | Environment setup validation |

## Running Tests

```bash
# Start dev server first
npm run dev

# Run all tests (requires X402_CLIENT_PK env var with testnet mnemonic)
bun run tests/_run_all_tests.ts

# Run specific category
bun run tests/_run_all_tests.ts --category=info      # Free info endpoints
bun run tests/_run_all_tests.ts --category=registry   # Registry lifecycle
bun run tests/_run_all_tests.ts --category=links      # Links lifecycle
bun run tests/_run_all_tests.ts --category=agent      # Agent endpoints

# Run info tests directly
bun run tests/info-endpoints.test.ts
```

## Test Modes

| Mode | Command | Description |
|------|---------|-------------|
| Quick | `--mode=quick` (default) | Stateless endpoints only |
| Full | `--mode=full` | Stateless + all lifecycle tests |
| Category | `--category=X` | Single category (info, registry, links, agent) |

## Registry Management

### User Endpoint Management

```bash
# List your registered endpoints
X402_CLIENT_PK="..." bun run tests/registry-manage.ts list

# Delete an endpoint you own
X402_CLIENT_PK="..." bun run tests/registry-manage.ts delete https://example.com/api/endpoint
```

### Admin Verification

```bash
# List pending endpoints
X402_PK="..." bun run tests/admin-verify.ts list

# Verify or reject
X402_PK="..." bun run tests/admin-verify.ts verify https://example.com/api/endpoint
```

## Relationships

- **Validates against**: `src/index.ts` route registrations
- **Uses**: `x402-stacks` client for payment signing

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/tests)*
