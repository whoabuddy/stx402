---
title: middleware
layout: default
parent: src
nav_order: 2
---

[← src](../src.md) | **middleware**

# middleware

> Request processing middleware for X402 payment verification and metrics tracking.

## Contents

| Item | Purpose |
|------|---------|
| [`x402-stacks.ts`](https://github.com/whoabuddy/stx402/blob/master/src/middleware/x402-stacks.ts) | X402 payment verification and settlement |
| [`metrics.ts`](https://github.com/whoabuddy/stx402/blob/master/src/middleware/metrics.ts) | Usage tracking to KV (calls, earnings, latency) |

## X402 Payment Flow

```
1. Request without X-PAYMENT header
   → 402 Response with payment requirements

2. Client signs payment via X402PaymentClient
   → Retry with X-PAYMENT header

3. Server verifies via X402PaymentVerifier
   → Settles payment on-chain
   → Adds X-PAYMENT-RESPONSE header
   → Continues to endpoint handler
```

### Payment Headers

| Header | Direction | Purpose |
|--------|-----------|---------|
| `X-PAYMENT` | Request | Signed payment data (base64) |
| `X-PAYMENT-TOKEN-TYPE` | Request | Token type (STX/sBTC/USDCx) |
| `X-PAYMENT-RESPONSE` | Response | Settlement result (txId, status) |

### Token Contracts

```typescript
// Mainnet
sBTC: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
USDCx: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx"

// Testnet
sBTC: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token"
USDCx: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx"
```

## Metrics Tracking

Single KV object stores all metrics (efficient read/write):

```typescript
interface MetricsData {
  version: 1;
  endpoints: Record<string, EndpointStats>;
  daily: Record<string, DailyStats>;
  updatedAt: string;
}

interface EndpointStats {
  calls: number;
  success: number;
  latencySum: number;
  earnings: { STX: number; sBTC: number; USDCx: number };
  lastCall: string;
}
```

### Middleware Usage

```typescript
// In index.ts route registration
openapi.post(
  "/api/stacks/bns-name/:address",
  paymentMiddleware,  // Verifies X402 payment
  trackMetrics,       // Records usage
  GetBnsName as any
);
```

## Relationships

- **Consumed by**: `src/index.ts` applies middleware to all paid routes
- **Depends on**: `x402-stacks` library, `utils/pricing.ts` for tier amounts
- **Writes to**: `METRICS` KV namespace

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/middleware) · Updated: 2025-01-07*
