---
title: Home
layout: home
nav_order: 1
---

# STX402 API

> A marketplace of useful API endpoints powered by X402 micropayments on Stacks.

STX402 is a Cloudflare Workers API providing **173 endpoints** across 20 categories. Each endpoint is simple, composable, and pays for itself through micropayments using STX, sBTC, or USDCx.

---

## Quick Start

```bash
# Get a 402 response with payment requirements
curl https://stx402.com/api/stacks/bns-name/SP000000000000000000002Q6VF78

# Pay with X402 client, get response
# See /guide for full integration details
```

---

## Endpoint Categories

| Category | Count | Description |
|----------|-------|-------------|
| [Stacks](src/endpoints.html#stacks) | 15 | Blockchain queries, BNS, Clarity utilities |
| [AI](src/endpoints.html#ai) | 13 | Text analysis, translation, image generation |
| [Text](src/endpoints.html#text) | 26 | Encoding, hashing, compression |
| [Data](src/endpoints.html#data) | 8 | JSON/CSV processing |
| [Random](src/endpoints.html#random) | 7 | Secure random generation |
| [Math](src/endpoints.html#math) | 6 | Calculations, statistics |
| [Utility](src/endpoints.html#utility) | 23 | Timestamps, DNS, QR codes |
| [Network](src/endpoints.html#network) | 6 | Geo-IP, ASN, SSL checks |
| [Crypto](src/endpoints.html#crypto) | 2 | RIPEMD-160, random bytes |
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
├── endpoints/       # 171 endpoint implementations
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
