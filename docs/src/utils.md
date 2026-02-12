---
title: utils
layout: default
parent: src
nav_order: 4
---

[← src](../src.md) | **utils**

# utils

> Shared utility functions for pricing, networking, Stacks integration, and common operations.

## Contents

| Item | Purpose |
|------|---------|
| [`pricing.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/pricing.ts) | Pricing tiers, `ENDPOINT_TIERS` mapping, `FREE_ENDPOINTS` set |
| [`network.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/network.ts) | Network detection from address prefix |
| [`bns.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/bns.ts) | BNS contract queries (resolve names) |
| [`wallet.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/wallet.ts) | Wallet derivation from mnemonic |
| [`hiro.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/hiro.ts) | Hiro API client for Stacks queries |
| [`logger.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/logger.ts) | Structured logging for Cloudflare Workers |
| [`erc8004.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/erc8004.ts) | ERC-8004 contract helpers, SIP-018 signing |
| [`registry.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/registry.ts) | Endpoint registry helpers |
| [`signatures.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/signatures.ts) | SIP-018 signature verification |
| [`payment.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/payment.ts) | Payment processing utilities, `strip0x`, `addressesMatchByHash160` |
| [`response.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/response.ts) | Response formatting helpers |
| [`probe.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/probe.ts) | Endpoint probing utilities |
| [`schema-helpers.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/schema-helpers.ts) | Shared OpenAPI schema constants (`TOKEN_TYPE_SCHEMA`) |
| [`x402-schema.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/x402-schema.ts) | X402 well-known schema and Bazaar metadata |
| [`endpoint-created-dates.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/endpoint-created-dates.ts) | Endpoint creation timestamps for Bazaar |

## Relationships

- **Consumed by**: All endpoints import utilities as needed
- **Depends on**: `@stacks/transactions`, `@stacks/network` for Stacks integration

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/utils)*
