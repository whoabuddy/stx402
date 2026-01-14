---
title: Home
layout: home
nav_order: 1
---

# STX402 Directory

> The meta layer for the X402 ecosystem - endpoint discovery and ERC-8004 agent identity on Stacks.

STX402 Directory is a Cloudflare Workers API providing **35 endpoints** across 4 categories. Each paid endpoint accepts micropayments using STX, sBTC, or USDCx via the X402 protocol.

**For general utilities, storage, and inference:** [x402.aibtc.com](https://x402.aibtc.com)

---

## Quick Start

```bash
# Check an endpoint's payment requirements
curl https://stx402.com/registry/probe \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/api"}'

# Browse all registered endpoints (free)
curl https://stx402.com/registry/list

# See /guide for full integration details
```

---

## Endpoint Categories

| Category | Count | Path Pattern | Description |
|----------|-------|--------------|-------------|
| [Info](src/endpoints.md#info) | 4 | `/health`, `/dashboard`, `/guide`, `/toolbox` | Service info & docs (free) |
| [Registry](src/endpoints.md#registry) | 10 | `/registry/*` | X402 endpoint directory |
| [Links](src/endpoints.md#links) | 5 | `/links/*` | URL shortener with analytics |
| [Agent](src/endpoints.md#agent) | 16 | `/agent/*` | ERC-8004 agent registry |

---

## Pricing Tiers

| Tier | STX | Use Case |
|------|-----|----------|
| `simple` | 0.001 | Agent registry queries |
| `ai` | 0.003 | Registry operations (probe, register) |
| `storage_read` | 0.0005 | Links stats, list |
| `storage_write` | 0.001 | Links create, delete |

---

## Architecture

```
src/
├── endpoints/       # 35 endpoint implementations
├── middleware/      # X402 payment verification
├── durable-objects/ # Per-user stateful storage (links)
├── utils/           # Shared utilities
└── components/      # Nav and UI components
```

See [src/](src.md) for detailed architecture documentation.

---

## Links

- **Live API**: [stx402.com](https://stx402.com)
- **API Docs**: [stx402.com/docs](https://stx402.com/docs)
- **Guide**: [stx402.com/guide](https://stx402.com/guide)
- **Dashboard**: [stx402.com/dashboard](https://stx402.com/dashboard)
- **GitHub**: [whoabuddy/stx402](https://github.com/whoabuddy/stx402)
