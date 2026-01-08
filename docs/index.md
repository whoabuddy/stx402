---
title: Home
layout: home
nav_order: 1
---

# STX402 API

> A marketplace of useful API endpoints powered by X402 micropayments on Stacks.

STX402 is a Cloudflare Workers API providing **~97 endpoints** across 16 categories. Each endpoint is simple, composable, and pays for itself through micropayments using STX, sBTC, or USDCx.

---

## Quick Start

```bash
# Get a 402 response with payment requirements
curl https://stx402.com/api/stacks/profile/SP000000000000000000002Q6VF78

# Pay with X402 client, get response
# See /guide for full integration details
```

---

## Endpoint Categories

| Category | Count | Description |
|----------|-------|-------------|
| [Stacks](src/endpoints.html#stacks) | 7 | Clarity utilities, profile, contract-info |
| [AI](src/endpoints.html#ai) | 13 | Text analysis, translation, image generation |
| [Hash](src/endpoints.html#hash) | 6 | SHA, Keccak, Hash160, RIPEMD160, HMAC |
| [Data](src/endpoints.html#data) | 2 | JSON minify/validate (free) |
| [Utility](src/endpoints.html#utility) | 2 | QR codes, signature verification |
| [Registry](src/endpoints.html#registry) | 10 | Endpoint marketplace |
| [Storage](src/endpoints.html#storage) | 36 | KV, paste, counters, SQL, links, sync, queue, memory |
| [Agent](src/endpoints.html#agent) | 16 | ERC-8004 agent registry |

---

## Pricing Tiers

| Tier | STX | Use Case |
|------|-----|----------|
| `simple` | 0.001 | Fast utilities, no external calls |
| `ai` | 0.003 | Light AI inference |
| `heavy_ai` | 0.01 | Image generation, heavy compute |
| `storage_read` | 0.0005 | KV get, list operations |
| `storage_write` | 0.001 | KV set, delete operations |

---

## Architecture

```
src/
├── endpoints/       # ~97 endpoint implementations
├── middleware/      # X402 payment verification
├── durable-objects/ # Per-user stateful storage
├── utils/           # Shared utilities
└── components/      # Toolbox UI components
```

See [src/](src.html) for detailed architecture documentation.

---

## Links

- **Live API**: [stx402.com](https://stx402.com)
- **OpenAPI Docs**: [stx402.com/docs](https://stx402.com/docs)
- **GitHub**: [whoabuddy/stx402](https://github.com/whoabuddy/stx402)
