# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

STX402 is a Cloudflare Workers API providing **100 useful endpoints** via X402 micropayments. Currently at 26 endpoints, scaling to 100+.

**Vision**: A marketplace of useful API endpoints where the best ones surface to the top based on usage and earnings. Each endpoint is simple, composable, and pays for itself through micropayments.

## Commands

```bash
npm run dev          # Local development with hot reload (Wrangler)
npm run deploy       # Deploy to Cloudflare Workers
npm run cf-typegen   # Regenerate Env types from wrangler bindings
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

## Architecture

### Endpoint Categories

| Category | Count | Path Pattern | Description |
|----------|-------|--------------|-------------|
| Health | 2 | `/api/health`, `/dashboard` | Free monitoring endpoints |
| Stacks | 8 | `/api/stacks/*` | Blockchain queries, Clarity utilities |
| AI | 6 | `/api/ai/*` | AI-powered analysis and generation |
| Random | 3 | `/api/random/*` | Cryptographically secure generation |
| Text | 6 | `/api/text/*` | Encoding, hashing, transformation |
| Utility | 1 | `/api/util/*` | General utilities |

### Pricing Tiers

Defined in `src/utils/pricing.ts`:

| Tier | STX | sBTC | USDCx | Use Case |
|------|-----|------|-------|----------|
| `simple` | 0.001 | 0.000001 | 0.001 | Fast utilities, no external calls |
| `ai` | 0.003 | 0.000003 | 0.003 | Light AI inference |
| `heavy_ai` | 0.01 | 0.00001 | 0.01 | Image generation, heavy compute |

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
3. Add to `ENDPOINT_TIERS` in `src/utils/pricing.ts` if non-default tier
4. Run `npm run cf-typegen` if using new env bindings

### Key Files

**Endpoints:**
- `src/endpoints/BaseEndpoint.ts` - Shared methods: `getTokenType()`, `validateAddress()`, `errorResponse()`
- `src/endpoints/stacks*.ts` - Stacks/Clarity endpoints (BNS, contracts, consensus buffers)
- `src/endpoints/ai*.ts` - AI endpoints (summarize, TTS, image generation, contract analysis)
- `src/endpoints/text*.ts` - Hashing (SHA, Keccak, Hash160), encoding (base64)
- `src/endpoints/random*.ts` - Secure random (UUID, numbers, strings)

**Middleware:**
- `src/middleware/x402-stacks.ts` - X402 payment verification/settlement
- `src/middleware/metrics.ts` - Usage tracking to KV

**Utilities:**
- `src/utils/pricing.ts` - Tier definitions and `ENDPOINT_TIERS` mapping
- `src/utils/network.ts` - Network detection from address prefix
- `src/utils/bns.ts` - BNS contract queries
- `src/utils/clarity.ts` - Clarity value decoder

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

AI Bindings:
- `AI` - Cloudflare Workers AI

## Roadmap to 100 Endpoints

### Next Priority Endpoints

**Text utilities (simple tier):**
- url-encode/decode, html-encode/decode
- jwt-decode, regex-test, regex-extract
- markdown-to-html, slugify, word-count

**Data transformation (simple tier):**
- json-format, json-minify, json-validate
- csv-to-json, json-to-csv
- yaml-to-json, xml-to-json

**More random (simple tier):**
- password (with requirements)
- color (hex/rgb/hsl)
- dice, shuffle

**Utilities (simple tier):**
- timestamp-convert, date-diff
- dns-lookup, ip-info
- qr-generate, url-parse

**More AI (ai/heavy_ai tier):**
- sentiment analysis
- language detection
- translate
- code-explain

### Design Principles

1. **One thing well** - Each endpoint has a single, clear purpose
2. **Composable** - Output from one endpoint can feed into another
3. **Minimal deps** - Prefer SubtleCrypto and @noble/hashes over external APIs
4. **Clarity compatible** - Hash functions match Clarity built-ins
5. **Cacheable** - Immutable data (contract source/ABI) can be cached forever
6. **Usage-driven** - Metrics track which endpoints are most valuable
