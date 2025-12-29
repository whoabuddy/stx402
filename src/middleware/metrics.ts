import type { Context } from "hono";
import {
  getEndpointTier,
  TIER_AMOUNTS,
  type TokenType,
  validateTokenType,
} from "../utils/pricing";

export interface EndpointMetrics {
  path: string;
  tier: string;
  totalCalls: number;
  successfulCalls: number;
  avgLatencyMs: number;
  successRate: string;
  earnings: {
    STX: string;
    sBTC: string;
    USDCx: string;
  };
  lastCall: string;
}

interface MetricsUpdateData {
  path: string;
  latency: number;
  isSuccess: boolean;
  tokenType: TokenType;
  amount: string;
}

// Update metrics in KV (fire-and-forget for performance)
async function updateMetrics(
  kv: KVNamespace,
  data: MetricsUpdateData
): Promise<void> {
  const { path, latency, isSuccess, tokenType, amount } = data;
  const prefix = `metrics:endpoint:${path}`;
  const today = new Date().toISOString().split("T")[0];

  try {
    // Get current values
    const [calls, success, latencySum, currentEarnings, dailyCalls] =
      await Promise.all([
        kv.get(`${prefix}:calls`),
        kv.get(`${prefix}:success`),
        kv.get(`${prefix}:latency_sum`),
        kv.get(`${prefix}:earnings:${tokenType}`),
        kv.get(`metrics:daily:${today}:calls`),
      ]);

    // Calculate new values
    const newCalls = parseInt(calls || "0") + 1;
    const newSuccess = parseInt(success || "0") + (isSuccess ? 1 : 0);
    const newLatencySum = parseInt(latencySum || "0") + latency;
    const newEarnings = (
      parseFloat(currentEarnings || "0") + parseFloat(amount)
    ).toFixed(6);
    const newDailyCalls = parseInt(dailyCalls || "0") + 1;

    // Batch write updates
    await Promise.all([
      kv.put(`${prefix}:calls`, String(newCalls)),
      kv.put(`${prefix}:success`, String(newSuccess)),
      kv.put(`${prefix}:latency_sum`, String(newLatencySum)),
      kv.put(`${prefix}:earnings:${tokenType}`, newEarnings),
      kv.put(`${prefix}:last_call`, new Date().toISOString()),
      kv.put(`metrics:daily:${today}:calls`, String(newDailyCalls)),
    ]);
  } catch (error) {
    // Log but don't fail the request
    console.error("Failed to update metrics:", error);
  }
}

// Get all metrics for a list of endpoint paths
export async function getAllMetrics(
  kv: KVNamespace,
  paths: string[]
): Promise<EndpointMetrics[]> {
  // Build all KV read promises upfront for parallel execution
  const readPromises = paths.map((path) => {
    const prefix = `metrics:endpoint:${path}`;
    return Promise.all([
      kv.get(`${prefix}:calls`),
      kv.get(`${prefix}:success`),
      kv.get(`${prefix}:latency_sum`),
      kv.get(`${prefix}:earnings:STX`),
      kv.get(`${prefix}:earnings:sBTC`),
      kv.get(`${prefix}:earnings:USDCx`),
      kv.get(`${prefix}:last_call`),
    ]);
  });

  // Execute all reads in parallel
  const results = await Promise.all(readPromises);

  // Process results
  return paths.map((path, index) => {
    const [calls, success, latencySum, earningsSTX, earningsBTC, earningsUSDC, lastCall] = results[index];

    const totalCalls = parseInt(calls || "0");
    const successfulCalls = parseInt(success || "0");
    const totalLatency = parseInt(latencySum || "0");

    return {
      path,
      tier: getEndpointTier(path),
      totalCalls,
      successfulCalls,
      avgLatencyMs: totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0,
      successRate:
        totalCalls > 0
          ? ((successfulCalls / totalCalls) * 100).toFixed(1)
          : "N/A",
      earnings: {
        STX: earningsSTX || "0",
        sBTC: earningsBTC || "0",
        USDCx: earningsUSDC || "0",
      },
      lastCall: lastCall || "Never",
    };
  });
}

// Get daily stats
export async function getDailyStats(
  kv: KVNamespace,
  days: number = 7
): Promise<{ date: string; calls: number }[]> {
  const today = new Date();
  const dates: string[] = [];

  // Build date list
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }

  // Fetch all daily stats in parallel
  const results = await Promise.all(
    dates.map((dateStr) => kv.get(`metrics:daily:${dateStr}:calls`))
  );

  // Build stats array (reversed to show oldest first)
  return dates
    .map((date, index) => ({
      date,
      calls: parseInt(results[index] || "0"),
    }))
    .reverse();
}

// Metrics middleware - tracks calls after payment is verified
export const metricsMiddleware = () => {
  return async (
    c: Context<{ Bindings: Env }>,
    next: () => Promise<Response | void>
  ) => {
    const start = Date.now();
    const path = c.req.path;

    // Execute the actual handler
    await next();

    const latency = Date.now() - start;
    const status = c.res?.status || 500;
    const isSuccess = status >= 200 && status < 300;

    // Only track metrics for paid requests (those with X-PAYMENT header)
    // This avoids counting 402 responses
    const paymentHeader = c.req.header("X-PAYMENT");
    if (!paymentHeader) return;

    // Get token type from header or query
    const headerTokenType = c.req.header("X-PAYMENT-TOKEN-TYPE") ?? "";
    const queryTokenType = c.req.query("tokenType") ?? "STX";
    const tokenTypeStr = headerTokenType || queryTokenType;

    let tokenType: TokenType;
    try {
      tokenType = validateTokenType(tokenTypeStr);
    } catch {
      tokenType = "STX";
    }

    // Get the amount for this endpoint
    const tier = getEndpointTier(path);
    const amount = TIER_AMOUNTS[tier][tokenType];

    // Fire-and-forget metrics update
    // Check if METRICS binding exists before using it
    if (c.env.METRICS) {
      c.executionCtx.waitUntil(
        updateMetrics(c.env.METRICS, {
          path,
          latency,
          isSuccess,
          tokenType,
          amount,
        })
      );
    }
  };
};
