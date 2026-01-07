# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

STX402 is a Cloudflare Workers API providing useful endpoints via X402 micropayments.

**Vision**: A marketplace of useful API endpoints where the best ones surface to the top based on usage and earnings. Each endpoint is simple, composable, and pays for itself through micropayments.

**Source of Truth**: Endpoint counts are defined in `tests/endpoint-registry.ts` which exports `ENDPOINT_COUNTS`. Run `npm run sync-counts` to update all documentation files with current counts.

## Commands

```bash
npm run dev          # Local development with hot reload (Wrangler)
npm run deploy       # Deploy to Cloudflare Workers
npm run cf-typegen   # Regenerate Env types from wrangler bindings
npm run sync-counts  # Sync endpoint counts to all documentation
```

### Running Tests

```bash
# Start dev server first
npm run dev

# Run all tests (requires .env with X402_CLIENT_PK testnet mnemonic)
bun run tests/_run_all_tests.ts

# Run individual test
bun run tests/get-bns-address.test.ts
```

### Registry Management Scripts

**User endpoint management** (`X402_CLIENT_PK` - your wallet):

```bash
# List your registered endpoints (mainnet by default)
X402_CLIENT_PK="..." bun run tests/registry-manage.ts list

# Delete an endpoint you own (requires SIP-018 signature)
X402_CLIENT_PK="..." bun run tests/registry-manage.ts delete https://example.com/api/endpoint

# Against testnet/local
X402_NETWORK=testnet X402_WORKER_URL=http://localhost:8787 X402_CLIENT_PK="..." bun run tests/registry-manage.ts list
```

**Admin verification** (`X402_PK` - server wallet, must match `X402_SERVER_ADDRESS`):

```bash
# List pending endpoints awaiting verification
X402_PK="..." bun run tests/admin-verify.ts list

# Verify or reject an endpoint
X402_PK="..." bun run tests/admin-verify.ts verify https://example.com/api/endpoint
X402_PK="..." bun run tests/admin-verify.ts reject https://example.com/api/endpoint

# Against testnet/staging
X402_NETWORK=testnet X402_WORKER_URL=https://stx402-staging.whoabuddy.workers.dev X402_PK="..." bun run tests/admin-verify.ts list
```

| Script | Env Var | Default Network | Default URL | Purpose |
|--------|---------|-----------------|-------------|---------|
| `registry-manage.ts` | `X402_CLIENT_PK` | mainnet | https://stx402.com | List/delete your endpoints |
| `admin-verify.ts` | `X402_PK` | mainnet | https://stx402.com | Verify/reject pending endpoints |

## Architecture

### Endpoint Categories

Counts from `tests/endpoint-registry.ts:ENDPOINT_COUNTS` (168 tested + 5 free = 173 total routes):

| Category | Count | Path Pattern | Tier | Description |
|----------|-------|--------------|------|-------------|
| Health | 5 | `/api/health`, `/dashboard`, `/about`, `/guide`, `/toolbox` | free | Monitoring & docs |
| Stacks | 15 | `/api/stacks/*` | simple | Blockchain queries, Clarity utilities |
| AI | 13 | `/api/ai/*` | ai/heavy_ai | AI-powered analysis and generation |
| Text | 26 | `/api/text/*` | simple | Encoding, hashing, compression |
| Data | 8 | `/api/data/*` | simple | JSON/CSV processing |
| Crypto | 2 | `/api/crypto/*` | simple | Cryptographic operations |
| Random | 7 | `/api/random/*` | simple | Secure random generation |
| Math | 6 | `/api/math/*` | simple | Mathematical operations |
| Utility | 23 | `/api/util/*` | simple | General utilities |
| Network | 6 | `/api/net/*` | simple | Network utilities |
| Registry | 10 | `/api/registry/*` | ai | Endpoint registry management |
| KV Storage | 4 | `/api/kv/*` | storage_* | Stateful key-value storage |
| Paste | 3 | `/api/paste/*` | storage_* | Text paste with short codes |
| Counter | 6 | `/api/counter/*` | storage_* | Atomic counters (Durable Objects) |
| SQL | 3 | `/api/sql/*` | storage_* | Direct SQLite access (Durable Objects) |
| Links | 5 | `/api/links/*` | storage_* | URL shortener with click tracking |
| Sync | 5 | `/api/sync/*` | storage_* | Distributed locks with auto-expiration |
| Queue | 5 | `/api/queue/*` | storage_* | Job queue with priority and retries |
| Memory | 5 | `/api/memory/*` | storage_ai | Agent memory with semantic search |
| Agent | 16 | `/api/agent/*` | simple | ERC-8004 agent registry (identity, reputation, validation) |

### Pricing Tiers

Defined in `src/utils/pricing.ts`:

| Tier | STX | sBTC | USDCx | Use Case |
|------|-----|------|-------|----------|
| `simple` | 0.001 | 0.000001 | 0.001 | Fast utilities, no external calls |
| `ai` | 0.003 | 0.000003 | 0.003 | Light AI inference |
| `heavy_ai` | 0.01 | 0.00001 | 0.01 | Image generation, heavy compute |
| `storage_read` | 0.0005 | 0.0000005 | 0.0005 | KV get, list operations |
| `storage_write` | 0.001 | 0.000001 | 0.001 | KV set, delete operations |
| `storage_write_large` | 0.005 | 0.000005 | 0.005 | Values > 100KB |
| `storage_ai` | 0.003 | 0.000003 | 0.003 | Memory store/search with embeddings |

### Endpoint Pattern

All endpoints extend `BaseEndpoint` and implement:
- `schema` - OpenAPI spec (tags, summary, parameters, responses)
- `handle(c: AppContext)` - Request handler

```typescript
import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class MyEndpoint extends BaseEndpoint {
  schema = {
    tags: ["Category"],
    summary: "(paid) Description",
    parameters: [...],
    responses: { "200": {...}, "402": {...} },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    // ... logic
    return c.json({ result, tokenType });
  }
}
```

### Adding a New Endpoint

1. Create `src/endpoints/NewEndpoint.ts` extending `BaseEndpoint`
2. Import and register in `src/index.ts`:
   ```typescript
   import { NewEndpoint } from "./endpoints/NewEndpoint";
   openapi.post("/api/category/endpoint", paymentMiddleware, trackMetrics, NewEndpoint as any);
   ```
3. Add to `ENDPOINT_TIERS` in `src/utils/pricing.ts`
4. Add test config to `tests/endpoint-registry.ts` in the appropriate category array
5. Run `npm run sync-counts` to update all documentation with new counts
6. Run `npm run cf-typegen` if using new env bindings

### Key Files

**Endpoints:**
- `src/endpoints/BaseEndpoint.ts` - Shared methods: `getTokenType()`, `getPayerAddress()`, `validateAddress()`, `errorResponse()`
- `src/endpoints/stacks*.ts` - Stacks/Clarity endpoints (BNS, contracts, consensus buffers)
- `src/endpoints/ai*.ts` - AI endpoints (summarize, TTS, image generation, contract analysis)
- `src/endpoints/text*.ts` - Hashing (SHA, Keccak, Hash160), encoding (base64, URL, hex)
- `src/endpoints/data*.ts` - JSON/CSV transformation and validation
- `src/endpoints/crypto*.ts` - RIPEMD-160, random bytes
- `src/endpoints/random*.ts` - Secure random (UUID, numbers, strings, passwords)
- `src/endpoints/math*.ts` - Calculate, statistics, prime check, factorial
- `src/endpoints/util*.ts` - Timestamps, DNS, QR codes, URL parsing, etc.
- `src/endpoints/net*.ts` - Network utilities (geo-IP, ASN, SSL checks)
- `src/endpoints/registry*.ts` - Endpoint registry management
- `src/endpoints/kv/*.ts` - KV storage endpoints (set, get, delete, list)
- `src/endpoints/paste/*.ts` - Paste endpoints (create, get, delete)
- `src/endpoints/counter/*.ts` - Atomic counter endpoints (increment, decrement, get, reset, list, delete)
- `src/endpoints/sql/*.ts` - SQL query endpoints (query, execute, schema)
- `src/endpoints/links/*.ts` - URL shortener endpoints (create, expand, stats, delete, list)
- `src/endpoints/sync/*.ts` - Distributed lock endpoints (lock, unlock, check, extend, list)
- `src/endpoints/queue/*.ts` - Job queue endpoints (push, pop, complete, fail, status)
- `src/endpoints/memory/*.ts` - Agent memory endpoints (store, recall, search, list, forget)
- `src/endpoints/agent/*.ts` - ERC-8004 agent registry endpoints (identity, reputation, validation)

**Durable Objects:**
- `src/durable-objects/UserDurableObject.ts` - Per-user SQLite-backed DO (counters, links, locks, queues, memories)

**Middleware:**
- `src/middleware/x402-stacks.ts` - X402 payment verification/settlement
- `src/middleware/metrics.ts` - Usage tracking to KV

**Utilities:**
- `src/utils/pricing.ts` - Tier definitions and `ENDPOINT_TIERS` mapping
- `src/utils/namespace.ts` - KV key formatting, validation, limits
- `src/utils/network.ts` - Network detection from address prefix
- `src/utils/bns.ts` - BNS contract queries
- `src/utils/clarity.ts` - Clarity value decoder
- `src/utils/erc8004.ts` - ERC-8004 contract addresses, read-only call helpers, SIP-018 signing

**Tests:**
- `tests/endpoint-registry.ts` - **Source of truth** for endpoint counts and test configs
- `tests/_run_all_tests.ts` - E2E payment test runner for all endpoints
- `tests/_validate_endpoints.ts` - Validates registry stays in sync with index.ts
- `tests/*-lifecycle.test.ts` - Stateful endpoint lifecycle tests (registry, links, DO)
- `tests/admin-verify.ts` - Admin registry verification script (requires server wallet)
- `tests/registry-manage.ts` - User endpoint management script

### X402 Payment Flow

1. Request without `X-PAYMENT` header → 402 with payment requirements
2. Client signs payment using X402PaymentClient
3. Retry with `X-PAYMENT` header (+ `X-PAYMENT-TOKEN-TYPE`)
4. Server verifies via X402PaymentVerifier, settles payment
5. If valid, adds `X-PAYMENT-RESPONSE` header, continues to endpoint

### Crypto Libraries

- **SubtleCrypto** (Web Crypto API) - SHA-256, SHA-512, random generation
- **@noble/hashes** - Keccak-256, RIPEMD160, SHA512/256 (for Clarity compatibility)
- **@stacks/transactions** - Clarity value serialization, address utilities

## Environment Variables

Configured in `wrangler.jsonc`:
- `X402_NETWORK` - "mainnet" or "testnet"
- `X402_PK` - Server mnemonic (receives payments)
- `X402_SERVER_ADDRESS` - Payment recipient address
- `X402_FACILITATOR_URL` - X402 facilitator endpoint

KV Namespaces:
- `METRICS` - Usage tracking (calls, earnings, latency)
- `STORAGE` - User key-value storage (namespaced by payer address)

Durable Objects:
- `USER_DO` - Per-user SQLite-backed Durable Object (counters, SQL)

AI Bindings:
- `AI` - Cloudflare Workers AI

## Design Principles

1. **One thing well** - Each endpoint has a single, clear purpose
2. **Composable** - Output from one endpoint can feed into another
3. **Minimal deps** - Prefer SubtleCrypto and @noble/hashes over external APIs
4. **Clarity compatible** - Hash functions match Clarity built-ins
5. **Cacheable** - Immutable data (contract source/ABI) can be cached forever
6. **Usage-driven** - Metrics track which endpoints are most valuable
