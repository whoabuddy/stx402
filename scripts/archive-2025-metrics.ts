#!/usr/bin/env bun
/**
 * Archive 2025 Metrics Migration Script
 *
 * Exports old v0 metrics (individual KV keys) to a single archive object.
 * Run this BEFORE the new metrics format overwrites the old data.
 *
 * Usage:
 *   bun run scripts/archive-2025-metrics.ts
 *
 * This script:
 * 1. Lists all metrics:* keys from the METRICS KV namespace
 * 2. Fetches values for each key
 * 3. Aggregates into a structured archive object
 * 4. Stores as metrics:archive:2025 in KV
 * 5. Outputs JSON to stdout for backup
 */

import { execSync } from "child_process";

// KV namespace ID from wrangler.jsonc (production METRICS)
const KV_NAMESPACE_ID = "fc344acd7f724b2a85ad0c961e9eb5a4";

interface OldEndpointMetrics {
  calls: number;
  success: number;
  latencySum: number;
  earnings: {
    STX: number;
    sBTC: number;
    USDCx: number;
  };
  lastCall: string;
}

interface DailyStats {
  calls: number;
}

interface Archive2025 {
  version: "archive-2025";
  exportedAt: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalEndpoints: number;
    activeEndpoints: number;
    totalCalls: number;
    totalEarnings: {
      STX: number;
      sBTC: number;
      USDCx: number;
    };
    avgSuccessRate: number;
  };
  endpoints: Record<string, OldEndpointMetrics>;
  daily: Record<string, DailyStats>;
  topEndpoints: Array<{
    path: string;
    calls: number;
    stx: number;
  }>;
}

function runWrangler(args: string): string {
  try {
    return execSync(`npx wrangler ${args}`, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
    });
  } catch (error: any) {
    console.error(`Wrangler command failed: ${args}`);
    console.error(error.message);
    return "";
  }
}

function getKvValue(key: string): string | null {
  try {
    const result = runWrangler(
      `kv key get "${key}" --namespace-id=${KV_NAMESPACE_ID}`
    );
    return result.trim();
  } catch {
    return null;
  }
}

async function main() {
  console.error("=".repeat(60));
  console.error("  2025 METRICS ARCHIVE EXPORT");
  console.error("=".repeat(60));
  console.error(`  Namespace: ${KV_NAMESPACE_ID}`);
  console.error("");

  // Step 1: List all keys with metrics: prefix
  console.error("Step 1: Listing all metrics keys...");
  const keysJson = runWrangler(
    `kv key list --namespace-id=${KV_NAMESPACE_ID} --prefix="metrics:"`
  );

  let keys: Array<{ name: string }> = [];
  try {
    keys = JSON.parse(keysJson);
  } catch {
    console.error("Failed to parse keys JSON");
    process.exit(1);
  }

  console.error(`  Found ${keys.length} keys`);

  // Separate endpoint keys from daily keys
  const endpointKeys = keys.filter((k) => k.name.startsWith("metrics:endpoint:"));
  const dailyKeys = keys.filter((k) => k.name.startsWith("metrics:daily:"));

  console.error(`  - Endpoint metrics keys: ${endpointKeys.length}`);
  console.error(`  - Daily stats keys: ${dailyKeys.length}`);
  console.error("");

  // Step 2: Extract unique endpoint paths
  console.error("Step 2: Extracting endpoint paths...");
  const pathSet = new Set<string>();
  for (const key of endpointKeys) {
    // Pattern: metrics:endpoint:/api/path/here:fieldname
    const match = key.name.match(/^metrics:endpoint:(\/[^:]+):/);
    if (match) {
      pathSet.add(match[1]);
    }
  }
  const paths = Array.from(pathSet);
  console.error(`  Found ${paths.length} unique endpoints`);
  console.error("");

  // Step 3: Fetch metrics for each endpoint
  console.error("Step 3: Fetching endpoint metrics...");
  const endpoints: Record<string, OldEndpointMetrics> = {};

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const prefix = `metrics:endpoint:${path}`;

    if ((i + 1) % 10 === 0 || i === paths.length - 1) {
      console.error(`  Progress: ${i + 1}/${paths.length}`);
    }

    const calls = getKvValue(`${prefix}:calls`);
    const success = getKvValue(`${prefix}:success`);
    const latencySum = getKvValue(`${prefix}:latency_sum`);
    const earningsSTX = getKvValue(`${prefix}:earnings:STX`);
    const earningsBTC = getKvValue(`${prefix}:earnings:sBTC`);
    const earningsUSDC = getKvValue(`${prefix}:earnings:USDCx`);
    const lastCall = getKvValue(`${prefix}:last_call`);

    endpoints[path] = {
      calls: parseInt(calls || "0"),
      success: parseInt(success || "0"),
      latencySum: parseInt(latencySum || "0"),
      earnings: {
        STX: parseFloat(earningsSTX || "0"),
        sBTC: parseFloat(earningsBTC || "0"),
        USDCx: parseFloat(earningsUSDC || "0"),
      },
      lastCall: lastCall || "",
    };
  }
  console.error("");

  // Step 4: Fetch daily stats
  console.error("Step 4: Fetching daily stats...");
  const daily: Record<string, DailyStats> = {};

  for (const key of dailyKeys) {
    // Pattern: metrics:daily:YYYY-MM-DD:calls
    const match = key.name.match(/^metrics:daily:(\d{4}-\d{2}-\d{2}):calls$/);
    if (match) {
      const date = match[1];
      const calls = getKvValue(key.name);
      daily[date] = { calls: parseInt(calls || "0") };
    }
  }

  const dates = Object.keys(daily).sort();
  console.error(`  Found ${dates.length} days of data`);
  if (dates.length > 0) {
    console.error(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }
  console.error("");

  // Step 5: Calculate summary stats
  console.error("Step 5: Calculating summary...");
  const activeEndpoints = Object.values(endpoints).filter((e) => e.calls > 0);
  const totalCalls = Object.values(endpoints).reduce((sum, e) => sum + e.calls, 0);
  const totalSTX = Object.values(endpoints).reduce((sum, e) => sum + e.earnings.STX, 0);
  const totalsBTC = Object.values(endpoints).reduce((sum, e) => sum + e.earnings.sBTC, 0);
  const totalUSDCx = Object.values(endpoints).reduce((sum, e) => sum + e.earnings.USDCx, 0);

  const successRates = activeEndpoints
    .map((e) => (e.calls > 0 ? (e.success / e.calls) * 100 : 0))
    .filter((r) => r > 0);
  const avgSuccessRate =
    successRates.length > 0
      ? successRates.reduce((a, b) => a + b, 0) / successRates.length
      : 0;

  // Top endpoints by calls
  const topEndpoints = Object.entries(endpoints)
    .map(([path, stats]) => ({
      path,
      calls: stats.calls,
      stx: stats.earnings.STX,
    }))
    .filter((e) => e.calls > 0)
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 20);

  console.error(`  Total calls: ${totalCalls}`);
  console.error(`  Active endpoints: ${activeEndpoints.length}`);
  console.error(`  Total STX earned: ${totalSTX.toFixed(4)}`);
  console.error("");

  // Step 6: Build archive object
  const archive: Archive2025 = {
    version: "archive-2025",
    exportedAt: new Date().toISOString(),
    period: {
      start: dates[0] || "2025-01-01",
      end: dates[dates.length - 1] || "2025-12-31",
    },
    summary: {
      totalEndpoints: paths.length,
      activeEndpoints: activeEndpoints.length,
      totalCalls,
      totalEarnings: {
        STX: totalSTX,
        sBTC: totalsBTC,
        USDCx: totalUSDCx,
      },
      avgSuccessRate,
    },
    endpoints,
    daily,
    topEndpoints,
  };

  // Step 7: Store in KV
  console.error("Step 6: Storing archive in KV...");
  const archiveJson = JSON.stringify(archive);

  // Write to temp file for wrangler
  const tempFile = "/tmp/archive-2025.json";
  await Bun.write(tempFile, archiveJson);

  runWrangler(
    `kv key put "metrics:archive:2025" --namespace-id=${KV_NAMESPACE_ID} --path="${tempFile}"`
  );
  console.error("  Stored as metrics:archive:2025");
  console.error("");

  // Step 8: Output JSON to stdout for backup
  console.error("Step 7: Writing JSON backup to stdout...");
  console.error("=".repeat(60));
  console.error("");

  // Output the archive JSON to stdout
  console.log(JSON.stringify(archive, null, 2));

  console.error("");
  console.error("=".repeat(60));
  console.error("  ARCHIVE COMPLETE");
  console.error("=".repeat(60));
  console.error("");
  console.error("  Next steps:");
  console.error("  1. Save the JSON output above as a backup file");
  console.error("  2. Deploy the new dashboard with archive page");
  console.error("  3. Verify at https://stx402.com/archive/2025");
  console.error("");
}

main().catch(console.error);
