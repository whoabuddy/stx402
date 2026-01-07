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
| [`endpoints/`](src/endpoints.md) | 173 endpoint implementations |
| [`middleware/`](src/middleware.md) | X402 payment verification, metrics tracking |
| [`durable-objects/`](src/durable-objects.md) | Per-user SQLite-backed Durable Object |
| [`utils/`](src/utils.md) | Shared utilities (pricing, network, BNS, etc.) |
| [`components/`](src/components.md) | React components for toolbox UI |

## Architecture

```
Request → Hono Router → X402 Middleware → Endpoint Handler → Response
                              ↓
                     Payment Verification
                              ↓
                      Metrics Tracking
```

### Key Patterns

1. **BaseEndpoint** - All paid endpoints extend `BaseEndpoint` for shared methods:
   - `getTokenType(c)` - Get payment token (STX/sBTC/USDCx)
   - `getPayerAddress(c)` - Extract payer from settlement
   - `validateAddress(c)` - Parse and validate Stacks addresses

2. **Chanfana/OpenAPI** - Routes are auto-documented via chanfana schemas

3. **Durable Objects** - Stateful endpoints use per-user `UserDurableObject` for:
   - Counters, SQL queries, links, locks, queues, memories

## Relationships

- **Entry point**: `index.ts` imports all endpoints and registers routes
- **Middleware chain**: `paymentMiddleware` → `trackMetrics` → endpoint
- **Storage**: Endpoints access KV via `c.env.STORAGE`, DO via `c.env.USER_DO`

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src) · Updated: 2025-01-07*
