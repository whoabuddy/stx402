---
title: src
layout: default
nav_order: 2
has_children: true
---

[← Home](index.md) | **src**

# src

> Application source code - Cloudflare Workers API with X402 payment integration.

## Contents

| Item | Purpose |
|------|---------|
| [`index.ts`](https://github.com/whoabuddy/stx402/blob/master/src/index.ts) | Application entry point, route registration |
| [`types.ts`](https://github.com/whoabuddy/stx402/blob/master/src/types.ts) | TypeScript type definitions (AppContext, Env) |
| [`endpoints/`](src/endpoints.md) | 35 endpoint implementations |
| [`middleware/`](src/middleware.md) | X402 payment verification, metrics tracking |
| [`durable-objects/`](src/durable-objects.md) | Per-user SQLite-backed Durable Object (links) |
| [`utils/`](src/utils.md) | Shared utilities (pricing, network, wallet, etc.) |
| [`components/`](src/components.md) | Navigation and shared UI components |

## Architecture

```
Request → Hono Router → X402 Middleware → Endpoint Handler → Response
                              ↓
                     Payment Verification
                              ↓
                      Metrics Tracking
```

### Key Patterns

1. **BaseEndpoint** - Most endpoints extend `BaseEndpoint` (which extends chanfana's `OpenAPIRoute`):
   - `getTokenType(c)` - Get payment token (STX/sBTC/USDCx)
   - `getPayerAddress(c)` - Extract payer from settlement
   - `parseJsonBody<T>(c)` - Safe JSON body parsing
   - `authenticateOwner(c, ...)` - Dual auth (signature or payment)

2. **Durable Objects** - Links endpoints use per-user `UserDurableObject` for SQLite storage

## Relationships

- **Entry point**: `index.ts` imports all endpoints and registers routes
- **Middleware chain**: `paymentMiddleware` → `trackMetrics` → endpoint
- **Storage**: Endpoints access KV via `c.env.METRICS`, DO via `c.env.USER_DO`

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src)*
