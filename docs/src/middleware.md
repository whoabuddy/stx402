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
| [`x402-stacks.ts`](https://github.com/whoabuddy/stx402/blob/master/src/middleware/x402-stacks.ts) | X402 V2 payment verification and settlement |
| [`metrics.ts`](https://github.com/whoabuddy/stx402/blob/master/src/middleware/metrics.ts) | Usage tracking to KV (calls, earnings, latency) |

## X402 V2 Payment Flow

```
1. Request without payment-signature header
   → 402 Response with payment requirements (JSON)

2. Client signs payment via X402PaymentClient
   → Retry with payment-signature header (base64 JSON)

3. Server verifies via X402PaymentVerifier
   → Settles payment on-chain
   → Adds payment-response header
   → Continues to endpoint handler
```

### Payment Headers (V2)

| Header | Direction | Purpose |
|--------|-----------|---------|
| `payment-signature` | Request | Signed payment data (base64 JSON) |
| `payment-response` | Response | Settlement result (txId, status) |

### Middleware Usage

```typescript
// In index.ts route registration
openapi.post(
  "/registry/probe",
  paymentMiddleware,  // Verifies X402 payment
  trackMetrics,       // Records usage
  RegistryProbe as any
);
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
```

## Relationships

- **Consumed by**: `src/index.ts` applies middleware to all paid routes
- **Depends on**: `x402-stacks` library, `utils/pricing.ts` for tier amounts
- **Writes to**: `METRICS` KV namespace

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/middleware)*
