import type { Context } from "hono";
import {
  getEndpointTier,
  TIER_AMOUNTS,
  type TokenType,
  validateTokenType,
} from "../utils/pricing";
import { log } from "../utils/logger";

// =============================================================================
// Types - Consolidated metrics storage
// =============================================================================

/** Metrics for a single endpoint */
export interface EndpointStats {
  calls: number;
  success: number;
  latencySum: number;
  earnings: {
    STX: number;
    sBTC: number;
    USDCx: number;
  };
  created: string; // ISO timestamp of first call
  lastCall: string; // ISO timestamp of most recent call
}

/** Daily aggregate stats */
export interface DailyStats {
  calls: number;
}

/** Root metrics object stored in KV */
export interface MetricsData {
  version: 1;
  endpoints: Record<string, EndpointStats>;
  daily: Record<string, DailyStats>; // keyed by YYYY-MM-DD
  updatedAt: string;
}

/** Public interface for dashboard display */
export interface EndpointMetrics {
  path: string;
  totalCalls: number;
  successfulCalls: number;
  avgLatencyMs: number;
  successRate: string;
  earnings: {
    STX: string;
    sBTC: string;
    USDCx: string;
  };
  created: string;
  lastCall: string;
}

// =============================================================================
// KV Key
// =============================================================================

const METRICS_KEY = "metrics:v1";

// =============================================================================
// Read Operations
// =============================================================================

/** Load the entire metrics object from KV (single read) */
async function loadMetrics(kv: KVNamespace): Promise<MetricsData> {
  const data = await kv.get<MetricsData>(METRICS_KEY, "json");
  if (data && data.version === 1) {
    return data;
  }
  // Return empty structure if not found or wrong version
  return {
    version: 1,
    endpoints: {},
    daily: {},
    updatedAt: new Date().toISOString(),
  };
}

/** Save the entire metrics object to KV (single write) */
async function saveMetrics(kv: KVNamespace, data: MetricsData): Promise<void> {
  data.updatedAt = new Date().toISOString();
  await kv.put(METRICS_KEY, JSON.stringify(data));
}

// =============================================================================
// Public Read Functions
// =============================================================================

/** Get all metrics for a list of endpoint paths - now just 1 KV read! */
export async function getAllMetrics(
  kv: KVNamespace,
  paths: string[]
): Promise<EndpointMetrics[]> {
  const data = await loadMetrics(kv);

  return paths.map((path) => {
    const stats = data.endpoints[path];

    if (!stats) {
      return {
        path,
        totalCalls: 0,
        successfulCalls: 0,
        avgLatencyMs: 0,
        successRate: "N/A",
        earnings: { STX: "0", sBTC: "0", USDCx: "0" },
        created: "Never",
        lastCall: "Never",
      };
    }

    const totalCalls = stats.calls;
    const successfulCalls = stats.success;

    return {
      path,
      totalCalls,
      successfulCalls,
      avgLatencyMs: totalCalls > 0 ? Math.round(stats.latencySum / totalCalls) : 0,
      successRate:
        totalCalls > 0
          ? ((successfulCalls / totalCalls) * 100).toFixed(1)
          : "N/A",
      earnings: {
        STX: stats.earnings.STX.toFixed(6),
        sBTC: stats.earnings.sBTC.toFixed(8),
        USDCx: stats.earnings.USDCx.toFixed(6),
      },
      created: stats.created || "Never",
      lastCall: stats.lastCall || "Never",
    };
  });
}

/** Get daily stats - now reads from same object, no extra KV calls */
export async function getDailyStats(
  kv: KVNamespace,
  days: number = 7
): Promise<{ date: string; calls: number }[]> {
  const data = await loadMetrics(kv);
  return extractDailyStats(data, days);
}

/** Extract daily stats from loaded data (no KV call) */
function extractDailyStats(
  data: MetricsData,
  days: number
): { date: string; calls: number }[] {
  const today = new Date();
  const results: { date: string; calls: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dailyData = data.daily[dateStr];
    results.push({
      date: dateStr,
      calls: dailyData?.calls || 0,
    });
  }

  return results;
}

/** Extract endpoint metrics from loaded data (no KV call) */
function extractEndpointMetrics(
  data: MetricsData,
  paths: string[]
): EndpointMetrics[] {
  return paths.map((path) => {
    const stats = data.endpoints[path];

    if (!stats) {
      return {
        path,
        totalCalls: 0,
        successfulCalls: 0,
        avgLatencyMs: 0,
        successRate: "N/A",
        earnings: { STX: "0", sBTC: "0", USDCx: "0" },
        created: "Never",
        lastCall: "Never",
      };
    }

    const totalCalls = stats.calls;
    const successfulCalls = stats.success;

    return {
      path,
      totalCalls,
      successfulCalls,
      avgLatencyMs: totalCalls > 0 ? Math.round(stats.latencySum / totalCalls) : 0,
      successRate:
        totalCalls > 0
          ? ((successfulCalls / totalCalls) * 100).toFixed(1)
          : "N/A",
      earnings: {
        STX: stats.earnings.STX.toFixed(6),
        sBTC: stats.earnings.sBTC.toFixed(8),
        USDCx: stats.earnings.USDCx.toFixed(6),
      },
      created: stats.created || "Never",
      lastCall: stats.lastCall || "Never",
    };
  });
}

/** Combined function for dashboard - single KV read for all data */
export async function getDashboardMetrics(
  kv: KVNamespace,
  paths: string[],
  days: number = 7
): Promise<{
  endpoints: EndpointMetrics[];
  daily: { date: string; calls: number }[];
}> {
  const data = await loadMetrics(kv);
  return {
    endpoints: extractEndpointMetrics(data, paths),
    daily: extractDailyStats(data, days),
  };
}

// =============================================================================
// Write Operations
// =============================================================================

interface MetricsUpdateData {
  path: string;
  latency: number;
  isSuccess: boolean;
  tokenType: TokenType;
  amount: string;
}

/** Update metrics - read-modify-write pattern */
async function updateMetrics(
  kv: KVNamespace,
  update: MetricsUpdateData
): Promise<void> {
  const { path, latency, isSuccess, tokenType, amount } = update;
  const today = new Date().toISOString().split("T")[0];

  try {
    // Load current data
    const data = await loadMetrics(kv);

    // Initialize endpoint if needed
    const now = new Date().toISOString();
    if (!data.endpoints[path]) {
      data.endpoints[path] = {
        calls: 0,
        success: 0,
        latencySum: 0,
        earnings: { STX: 0, sBTC: 0, USDCx: 0 },
        created: now,
        lastCall: "",
      };
    }

    // Update endpoint stats
    const endpoint = data.endpoints[path];
    endpoint.calls += 1;
    endpoint.success += isSuccess ? 1 : 0;
    endpoint.latencySum += latency;
    endpoint.earnings[tokenType] += parseFloat(amount);
    endpoint.lastCall = now;

    // Update daily stats
    if (!data.daily[today]) {
      data.daily[today] = { calls: 0 };
    }
    data.daily[today].calls += 1;

    // Prune old daily data (keep 30 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    for (const dateKey of Object.keys(data.daily)) {
      if (dateKey < cutoffStr) {
        delete data.daily[dateKey];
      }
    }

    // Save back
    await saveMetrics(kv, data);
  } catch (error) {
    // Log but don't fail the request
    log.error("Failed to update metrics", { error: String(error), path });
  }
}

// =============================================================================
// Middleware
// =============================================================================

/** Metrics middleware - tracks calls after payment is verified */
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
