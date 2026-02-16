# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**STX402 Directory** is the meta layer for the X402 ecosystem - a Cloudflare Workers API focused on endpoint discovery and agent identity.

**Purpose**:
- **Registry**: Discover and register X402-compatible endpoints across the ecosystem
- **Agent**: ERC-8004 agent identity, reputation, and validation on Stacks
- **Links**: URL shortener with click tracking (utility for agents/services)

**Related**: For general utilities, storage, and inference, use [x402.aibtc.com](https://x402.aibtc.com)

## Commands

```bash
npm run dev          # Local development with hot reload (Wrangler)
npm run deploy       # Deploy to Cloudflare Workers (use --dry-run first)
npm run cf-typegen   # Regenerate Env types from wrangler bindings
```

### Running Tests

```bash
# Start dev server first
npm run dev

# Run all tests (requires .env with X402_CLIENT_PK testnet mnemonic)
bun run tests/_run_all_tests.ts
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
```

## Architecture

### Endpoint Categories

36 endpoints across 4 categories:

| Category | Count | Path Pattern | Tier | Description |
|----------|-------|--------------|------|-------------|
| Info | 5 | `/health`, `/dashboard`, `/guide`, `/toolbox`, `/x402.json` | free | Service info & docs |
| Registry | 10 | `/registry/*` | ai | X402 endpoint directory |
| Links | 5 | `/links/*` | storage_* | URL shortener with analytics |
| Agent | 16 | `/agent/*` | simple | ERC-8004 agent registry |

### URL Structure

Routes follow aibtc convention (no `/api/` prefix):
- `GET /` - JSON service info
- `GET /docs` - Swagger UI API documentation
- `GET /health` - Health check
- `POST /registry/register` - Register an endpoint
- `GET /agent/registry` - ERC-8004 contract info

### Pricing Tiers

Defined in `src/utils/pricing.ts`:

| Tier | STX | Use Case |
|------|-----|----------|
| `simple` | 0.001 | Agent registry queries |
| `ai` | 0.003 | Registry operations (probe, register) |
| `storage_read` | 0.0005 | Links stats, list |
| `storage_write` | 0.001 | Links create, delete |

### Key Files

**Endpoints:**
- `src/endpoints/BaseEndpoint.ts` - Shared methods
- `src/endpoints/registry*.ts` - X402 endpoint directory (10 endpoints)
- `src/endpoints/links/*.ts` - URL shortener (5 endpoints)
- `src/endpoints/agent/*.ts` - ERC-8004 agent registry (16 endpoints)

**Durable Objects:**
- `src/durable-objects/UserDurableObject.ts` - Per-user SQLite-backed DO (links storage)

**Middleware:**
- `src/middleware/x402-stacks.ts` - X402 payment verification/settlement
- `src/middleware/metrics.ts` - Usage tracking to KV

**Utilities:**
- `src/utils/pricing.ts` - Tier definitions and `ENDPOINT_TIERS` mapping
- `src/utils/erc8004.ts` - ERC-8004 contract addresses and helpers

**Tests:**
- `tests/endpoint-registry.ts` - Source of truth for endpoint counts
- `tests/_run_all_tests.ts` - E2E payment test runner
- `tests/info-endpoints.test.ts` - Free info endpoint tests (health, guide, etc.)
- `tests/registry-lifecycle.test.ts` - Registry CRUD tests
- `tests/links-lifecycle.test.ts` - Links CRUD tests
- `tests/agent-registry.test.ts` - ERC-8004 endpoint tests

### X402 Payment Flow

1. Request without payment → 402 with `payment-required` header (base64 JSON)
2. Client signs payment using X402PaymentClient
3. Retry with `payment-signature` header (base64 JSON) + optional `X-PAYMENT-TOKEN-TYPE`
4. Server verifies via X402PaymentVerifier, settles payment
5. If valid, adds `payment-response` header (base64 JSON), continues to endpoint

## Environment Variables

Configured in `wrangler.jsonc`:
- `X402_NETWORK` - "mainnet" or "testnet"
- `X402_PK` - Server mnemonic (receives payments)
- `X402_SERVER_ADDRESS` - Payment recipient address
- `X402_FACILITATOR_URL` - X402 facilitator endpoint

KV Namespaces:
- `METRICS` - Usage tracking (calls, earnings, latency)
- `STORAGE` - Registry data and user storage

Durable Objects:
- `USER_DO` - Per-user SQLite-backed Durable Object (links)

## Design Principles

1. **Meta layer** - Discovery and identity, not general utilities
2. **Directory first** - Help users find X402 endpoints
3. **Agent identity** - ERC-8004 interface for Stacks agents
4. **Minimal scope** - General utilities live on x402.aibtc.com
