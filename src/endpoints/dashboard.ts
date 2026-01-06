import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";
import { ENDPOINT_TIERS } from "../utils/pricing";
import { getDashboardMetrics, type EndpointMetrics } from "../middleware/metrics";
import { listAllEntries, type RegistryEntryMinimal } from "../utils/registry";

// Extract category from path (e.g., /api/stacks/... → Stacks)
function getCategoryFromPath(path: string): string {
  const match = path.match(/^\/api\/([^/]+)/);
  if (!match) return "Other";
  const cat = match[1];
  // Capitalize first letter
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export class Dashboard extends OpenAPIRoute {
  schema = {
    tags: ["System"],
    summary: "View API metrics dashboard (free)",
    responses: {
      "200": {
        description: "HTML dashboard",
        content: {
          "text/html": {
            schema: { type: "string" as const },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    // Get all endpoint paths from ENDPOINT_TIERS
    const paths = Object.keys(ENDPOINT_TIERS);

    let metrics: EndpointMetrics[] = [];
    let dailyStats: { date: string; calls: number }[] = [];
    let registryEntries: RegistryEntryMinimal[] = [];

    // Only fetch metrics if METRICS KV is configured
    if (c.env.METRICS) {
      // Single KV read for metrics + daily stats, separate read for registry
      const [dashboardData, registryResult] = await Promise.all([
        getDashboardMetrics(c.env.METRICS, paths, 7),
        listAllEntries(c.env.METRICS, { limit: 100 }),
      ]);
      metrics = dashboardData.endpoints;
      dailyStats = dashboardData.daily;
      registryEntries = registryResult.entries.filter(e => e.status !== "rejected");
    } else {
      // Generate placeholder data when KV is not configured
      metrics = paths.map((path) => ({
        path,
        tier: ENDPOINT_TIERS[path] || "simple",
        totalCalls: 0,
        successfulCalls: 0,
        avgLatencyMs: 0,
        successRate: "N/A",
        earnings: { STX: "0", sBTC: "0", USDCx: "0" },
        lastCall: "Never",
      }));
    }

    // Calculate totals
    const totalEndpoints = metrics.length;
    const totalCalls = metrics.reduce((sum, m) => sum + m.totalCalls, 0);
    const totalSTX = metrics.reduce(
      (sum, m) => sum + parseFloat(m.earnings.STX),
      0
    );
    const totalsBTC = metrics.reduce(
      (sum, m) => sum + parseFloat(m.earnings.sBTC),
      0
    );
    const totalUSDCx = metrics.reduce(
      (sum, m) => sum + parseFloat(m.earnings.USDCx),
      0
    );
    const activeEndpoints = metrics.filter((m) => m.totalCalls > 0);
    const avgSuccessRate =
      activeEndpoints.length > 0
        ? (
            activeEndpoints.reduce(
              (sum, m) =>
                sum + (m.successRate !== "N/A" ? parseFloat(m.successRate) : 0),
              0
            ) / activeEndpoints.length
          ).toFixed(1)
        : "N/A";

    // Count by tier
    const tierCounts = {
      simple: metrics.filter((m) => m.tier === "simple").length,
      ai: metrics.filter((m) => m.tier === "ai").length,
      heavy_ai: metrics.filter((m) => m.tier === "heavy_ai").length,
    };

    // Count by category with calls
    const categoryStats: Record<string, { count: number; calls: number; stx: number }> = {};
    for (const m of metrics) {
      const cat = getCategoryFromPath(m.path);
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, calls: 0, stx: 0 };
      }
      categoryStats[cat].count++;
      categoryStats[cat].calls += m.totalCalls;
      categoryStats[cat].stx += parseFloat(m.earnings.STX);
    }

    const html = generateDashboardHTML({
      metrics,
      dailyStats,
      totals: {
        endpoints: totalEndpoints,
        calls: totalCalls,
        stx: totalSTX,
        sbtc: totalsBTC,
        usdcx: totalUSDCx,
        avgSuccessRate,
      },
      tierCounts,
      categoryStats,
      activeEndpoints,
      kvConfigured: !!c.env.METRICS,
      registryEntries,
    });

    return c.html(html);
  }
}

function generateDashboardHTML(data: {
  metrics: EndpointMetrics[];
  dailyStats: { date: string; calls: number }[];
  totals: {
    endpoints: number;
    calls: number;
    stx: number;
    sbtc: number;
    usdcx: number;
    avgSuccessRate: string;
  };
  tierCounts: { simple: number; ai: number; heavy_ai: number };
  categoryStats: Record<string, { count: number; calls: number; stx: number }>;
  activeEndpoints: EndpointMetrics[];
  kvConfigured: boolean;
  registryEntries: RegistryEntryMinimal[];
}): string {
  const { metrics, dailyStats, totals, tierCounts, categoryStats, activeEndpoints, kvConfigured, registryEntries } = data;

  // Sort by total calls descending
  const sortedMetrics = [...metrics].sort((a, b) => b.totalCalls - a.totalCalls);

  // Calculate max for daily chart (use at least 1 to avoid division by zero)
  const maxDailyCalls = Math.max(...dailyStats.map((d) => d.calls), 1);

  // Sort categories by calls for the chart
  const sortedCategories = Object.entries(categoryStats)
    .sort((a, b) => b[1].calls - a[1].calls);
  const maxCategoryCalls = Math.max(...sortedCategories.map(([, s]) => s.calls), 1);

  // Simplified category colors (A11Y compliant, 4 color groups)
  // Orange: blockchain, Purple: AI, Cyan: utilities, Blue: structured data
  const categoryColors: Record<string, string> = {
    Stacks: "#f7931a",  // Orange - blockchain
    Crypto: "#fb923c",  // Light orange - blockchain
    Ai: "#a855f7",      // Purple - AI premium
    Text: "#06b6d4",    // Cyan - utilities
    Util: "#22d3ee",    // Light cyan - utilities
    Random: "#0ea5e9",  // Sky blue - utilities
    Data: "#3b82f6",    // Blue - structured
    Math: "#6366f1",    // Indigo - structured
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>STX402 API Dashboard</title>
  <link rel="preconnect" href="https://rsms.me/">
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
  <style>
    :root {
      --bg-primary: #09090b;
      --bg-card: #0f0f12;
      --bg-hover: #18181b;
      --border: rgba(255,255,255,0.06);
      --border-hover: rgba(255,255,255,0.1);
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --accent: #f7931a;
      --accent-dim: rgba(247, 147, 26, 0.12);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      padding: 32px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 1600px; margin: 0 auto; }
    .header-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }
    .logo {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #f7931a 0%, #c2410c 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      color: #000;
      box-shadow: 0 4px 12px rgba(247, 147, 26, 0.3);
    }
    h1 {
      font-size: 26px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }
    h1 .accent { color: var(--accent); }
    .subtitle { color: var(--text-muted); margin-bottom: 32px; font-size: 14px; }
    .warning {
      background: #422006;
      border: 1px solid #f59e0b;
      color: #fbbf24;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      transition: all 0.2s ease;
    }
    .card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }
    .card h3 {
      color: var(--text-muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 10px;
      font-weight: 500;
    }
    .card .value {
      font-size: 32px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }
    .card .value.stx { color: #06b6d4; }
    .card .value.sbtc { color: var(--accent); }
    .card .value.usdcx { color: #3b82f6; }
    .card .value.success { color: #22c55e; }
    .tier-badges {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    .tier-badge {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
    }
    .tier-badge.simple { background: #164e63; color: #22d3ee; }
    .tier-badge.ai { background: #581c87; color: #c4b5fd; }
    .tier-badge.heavy_ai { background: #7c2d12; color: #fdba74; }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #fff;
    }
    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }
    @media (max-width: 900px) {
      .charts-row { grid-template-columns: 1fr; }
    }
    .chart-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
    }
    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      height: 140px;
    }
    .bar-day {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      height: 100%;
      justify-content: flex-end;
    }
    .bar {
      width: 100%;
      background: linear-gradient(180deg, #f7931a 0%, #c2410c 100%);
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: height 0.3s;
    }
    .bar-label {
      font-size: 11px;
      color: #71717a;
    }
    .bar-value {
      font-size: 11px;
      color: #a1a1aa;
      font-weight: 500;
    }
    .horiz-bar-chart {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .horiz-bar-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .horiz-bar-label {
      width: 60px;
      font-size: 12px;
      color: #a1a1aa;
      text-align: right;
      flex-shrink: 0;
    }
    .horiz-bar-track {
      flex: 1;
      height: 24px;
      background: #27272a;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }
    .horiz-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
      display: flex;
      align-items: center;
      padding-left: 8px;
    }
    .horiz-bar-value {
      font-size: 11px;
      color: #fff;
      font-weight: 500;
      white-space: nowrap;
    }
    .horiz-bar-count {
      font-size: 11px;
      color: #71717a;
      margin-left: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      text-align: left;
      padding: 12px 16px;
      background: #18181b;
      color: #71717a;
      font-weight: 500;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #27272a;
      position: sticky;
      top: 0;
      cursor: pointer;
      user-select: none;
      transition: color 0.15s;
    }
    th:hover { color: #a1a1aa; }
    th .sort-icon {
      display: inline-block;
      margin-left: 4px;
      opacity: 0.3;
      transition: opacity 0.15s;
    }
    th.sorted .sort-icon { opacity: 1; color: #f7931a; }
    th.sorted { color: #f7931a; }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #27272a;
      vertical-align: middle;
    }
    tr:hover { background: #1f1f23; }
    code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      background: #27272a;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .tier-simple { color: #22d3ee; }
    .tier-ai { color: #c4b5fd; }
    .tier-heavy_ai { color: #fdba74; }
    .cat-stacks { color: #f7931a; }
    .cat-crypto { color: #fb923c; }
    .cat-ai { color: #a855f7; }
    .cat-text { color: #06b6d4; }
    .cat-util { color: #22d3ee; }
    .cat-random { color: #0ea5e9; }
    .cat-data { color: #3b82f6; }
    .cat-math { color: #6366f1; }
    .success-high { color: #4ade80; }
    .success-med { color: #fbbf24; }
    .success-low { color: #f87171; }
    .table-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
    }
    .table-scroll {
      max-height: 600px;
      overflow-y: auto;
    }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
    .footer a { color: var(--accent); text-decoration: none; transition: opacity 0.2s; }
    .footer a:hover { opacity: 0.8; }
    .section-nav {
      display: flex;
      gap: 8px;
      margin-bottom: 32px;
      flex-wrap: wrap;
    }
    .section-nav a {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 10px 18px;
      border-radius: 10px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    .section-nav a:hover {
      background: var(--bg-hover);
      border-color: var(--border-hover);
      color: var(--text-primary);
      transform: translateY(-1px);
    }
    .section-title {
      scroll-margin-top: 24px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .stat-item {
      background: #27272a;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .stat-item .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
    }
    .stat-item .stat-label {
      font-size: 10px;
      color: #71717a;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .copy-btn {
      background: #27272a;
      border: 1px solid #3f3f46;
      color: #a1a1aa;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .copy-btn:hover {
      background: #3f3f46;
      color: #fff;
      border-color: #52525b;
    }
    .copy-btn.copied {
      background: #166534;
      border-color: #22c55e;
      color: #4ade80;
    }
    .copy-btn svg {
      width: 12px;
      height: 12px;
    }
    .owner-link {
      color: #f7931a;
      text-decoration: none;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 11px;
      background: #27272a;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.15s;
    }
    .owner-link:hover {
      background: #3f3f46;
      color: #fbbf24;
    }
    .url-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .host-badge {
      background: #1e3a5f;
      color: #60a5fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .path-code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 11px;
      color: #a1a1aa;
    }

    /* Mobile optimizations */
    @media (max-width: 600px) {
      body { padding: 16px; }
      h1 { font-size: 20px; }
      .logo { width: 32px; height: 32px; font-size: 12px; }
      .subtitle { font-size: 12px; margin-bottom: 20px; }
      .section-nav { gap: 6px; margin-bottom: 20px; }
      .section-nav a { padding: 8px 12px; font-size: 12px; }
      .summary { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .card { padding: 16px; border-radius: 12px; }
      .card h3 { font-size: 10px; margin-bottom: 6px; }
      .card .value { font-size: 20px; word-break: break-word; }
      .tier-badges { gap: 4px; margin-top: 8px; }
      .tier-badge { font-size: 9px; padding: 3px 6px; }
      .section-title { font-size: 16px; }
      .chart-container { padding: 16px; border-radius: 12px; }
      .bar-chart { gap: 4px; height: 100px; }
      .bar-value, .bar-label { font-size: 9px; }
      .horiz-bar-label { width: 50px; font-size: 10px; }
      .horiz-bar-track { height: 20px; }
      .horiz-bar-value { font-size: 9px; }
      .horiz-bar-count { display: none; }
      .charts-row { gap: 16px; }
      .table-container { border-radius: 12px; }
      table { font-size: 11px; }
      th, td { padding: 8px 10px; }
      code { font-size: 10px; padding: 2px 4px; }
      .footer { margin-top: 32px; padding-top: 16px; font-size: 11px; }
      .copy-btn { padding: 3px 6px; font-size: 10px; }
      .host-badge { font-size: 9px; padding: 2px 4px; }
      .path-code { font-size: 9px; }
      .owner-link { font-size: 9px; padding: 3px 6px; }
    }

    /* Extra small screens */
    @media (max-width: 380px) {
      .summary { grid-template-columns: 1fr; }
      .card .value { font-size: 24px; }
      .header-row { gap: 8px; }
      h1 { font-size: 18px; }
      .section-nav a { padding: 6px 10px; font-size: 11px; }
    }

    /* Hide less important columns on mobile */
    @media (max-width: 768px) {
      th:nth-child(6), td:nth-child(6),
      th:nth-child(8), td:nth-child(8),
      th:nth-child(9), td:nth-child(9) { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-row">
      <div class="logo">402</div>
      <h1><span class="accent">STX402</span> Dashboard</h1>
    </div>
    <p class="subtitle">Real-time metrics for X402 payment-gated endpoints on Stacks</p>

    <nav class="section-nav">
      <a href="#summary">Summary</a>
      <a href="#daily">Daily Activity</a>
      <a href="#endpoint-metrics">STX402 Endpoint Metrics</a>
      <a href="#x402-registry">X402 Registry</a>
      <a href="#agent-registry">Agent Registry</a>
    </nav>

    ${!kvConfigured ? `
    <div class="warning">
      KV namespace not configured. Metrics will not persist.
      Run <code>wrangler kv namespace create METRICS</code> and update wrangler.jsonc.
    </div>
    ` : ""}

    <h2 id="summary" class="section-title">Summary</h2>
    <div class="summary">
      <div class="card">
        <h3>Total Endpoints</h3>
        <div class="value">${totals.endpoints}</div>
        <div class="tier-badges">
          <span class="tier-badge simple">${tierCounts.simple} simple</span>
          <span class="tier-badge ai">${tierCounts.ai} ai</span>
          <span class="tier-badge heavy_ai">${tierCounts.heavy_ai} heavy</span>
        </div>
      </div>
      <div class="card">
        <h3>Total Calls</h3>
        <div class="value">${totals.calls.toLocaleString()}</div>
      </div>
      <div class="card">
        <h3>STX Earned</h3>
        <div class="value stx">${totals.stx.toFixed(4)}</div>
      </div>
      <div class="card">
        <h3>sBTC Earned</h3>
        <div class="value sbtc">${totals.sbtc.toFixed(8)}</div>
      </div>
      <div class="card">
        <h3>USDCx Earned</h3>
        <div class="value usdcx">${totals.usdcx.toFixed(4)}</div>
      </div>
      <div class="card">
        <h3>Avg Success Rate</h3>
        <div class="value success">${totals.avgSuccessRate}%</div>
      </div>
    </div>

    <div id="daily" class="chart-container" style="margin-bottom: 32px;">
      <h2 class="section-title">Daily Activity (Last 7 Days)</h2>
      <div class="bar-chart">
        ${dailyStats.map((day) => {
          const heightPx = Math.max((day.calls / maxDailyCalls) * 100, 4);
          return `
            <div class="bar-day">
              <div class="bar-value">${day.calls.toLocaleString()}</div>
              <div class="bar" style="height: ${heightPx}px"></div>
              <div class="bar-label">${day.date.slice(5)}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-container">
        <h2 class="section-title">Calls by Category</h2>
        <div class="horiz-bar-chart">
          ${sortedCategories.map(([cat, stats]) => {
            const widthPct = Math.max((stats.calls / maxCategoryCalls) * 100, 2);
            const color = categoryColors[cat] || "#71717a";
            return `
              <div class="horiz-bar-row">
                <div class="horiz-bar-label">${cat}</div>
                <div class="horiz-bar-track">
                  <div class="horiz-bar-fill" style="width: ${widthPct}%; background: ${color};">
                    <span class="horiz-bar-value">${stats.calls.toLocaleString()}</span>
                  </div>
                </div>
                <span class="horiz-bar-count">${stats.count} endpoints</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <div class="chart-container">
        <h2 class="section-title">Earnings by Category (STX)</h2>
        <div class="horiz-bar-chart">
          ${sortedCategories
            .sort((a, b) => b[1].stx - a[1].stx)
            .map(([cat, stats]) => {
              const maxStx = Math.max(...sortedCategories.map(([, s]) => s.stx), 0.0001);
              const widthPct = Math.max((stats.stx / maxStx) * 100, 2);
              const color = categoryColors[cat] || "#71717a";
              return `
                <div class="horiz-bar-row">
                  <div class="horiz-bar-label">${cat}</div>
                  <div class="horiz-bar-track">
                    <div class="horiz-bar-fill" style="width: ${widthPct}%; background: ${color};">
                      <span class="horiz-bar-value">${stats.stx.toFixed(4)} STX</span>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
        </div>
      </div>
    </div>

    <h2 id="endpoint-metrics" class="section-title">STX402 Endpoint Metrics</h2>
    <div class="table-container">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th data-sort="path">Endpoint <span class="sort-icon">↕</span></th>
              <th data-sort="category">Category <span class="sort-icon">↕</span></th>
              <th data-sort="tier">Tier <span class="sort-icon">↕</span></th>
              <th data-sort="calls" class="sorted">Calls <span class="sort-icon">↓</span></th>
              <th data-sort="success">Success <span class="sort-icon">↕</span></th>
              <th data-sort="latency">Latency <span class="sort-icon">↕</span></th>
              <th data-sort="stx">STX <span class="sort-icon">↕</span></th>
              <th data-sort="sbtc">sBTC <span class="sort-icon">↕</span></th>
              <th data-sort="lastcall">Last Call <span class="sort-icon">↕</span></th>
            </tr>
          </thead>
          <tbody>
            ${sortedMetrics.map((m) => {
              const category = getCategoryFromPath(m.path);
              const successClass =
                m.successRate === "N/A"
                  ? ""
                  : parseFloat(m.successRate) >= 95
                  ? "success-high"
                  : parseFloat(m.successRate) >= 80
                  ? "success-med"
                  : "success-low";
              const lastCallTs = m.lastCall === "Never" ? 0 : new Date(m.lastCall).getTime();
              const lastCallDisplay =
                m.lastCall === "Never"
                  ? "-"
                  : new Date(m.lastCall).toLocaleString();
              const successNum = m.successRate === "N/A" ? -1 : parseFloat(m.successRate);
              return `
                <tr data-path="${m.path}" data-category="${category}" data-tier="${m.tier}" data-calls="${m.totalCalls}" data-success="${successNum}" data-latency="${m.avgLatencyMs}" data-stx="${m.earnings.STX}" data-sbtc="${m.earnings.sBTC}" data-lastcall="${lastCallTs}">
                  <td><code>${m.path}</code></td>
                  <td class="cat-${category.toLowerCase()}">${category}</td>
                  <td class="tier-${m.tier}">${m.tier}</td>
                  <td>${m.totalCalls.toLocaleString()}</td>
                  <td class="${successClass}">${m.successRate}%</td>
                  <td>${m.avgLatencyMs}ms</td>
                  <td>${m.earnings.STX}</td>
                  <td>${m.earnings.sBTC}</td>
                  <td>${lastCallDisplay}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    ${registryEntries.length > 0 ? `
    <h2 id="x402-registry" class="section-title" style="margin-top: 32px;">X402 Endpoint Registry</h2>
    <div class="table-container">
      <div class="table-scroll" style="max-height: 400px;">
        <table id="registry-table">
          <thead>
            <tr>
              <th data-sort="owner">Owner <span class="sort-icon">↕</span></th>
              <th data-sort="name">Name <span class="sort-icon">↕</span></th>
              <th data-sort="category">Category <span class="sort-icon">↕</span></th>
              <th data-sort="host">Host <span class="sort-icon">↕</span></th>
              <th data-sort="path">Path <span class="sort-icon">↕</span></th>
              <th>URL</th>
              <th data-sort="status">Status <span class="sort-icon">↕</span></th>
              <th data-sort="registered" class="sorted">Published <span class="sort-icon">↓</span></th>
              <th data-sort="updated">Updated <span class="sort-icon">↕</span></th>
            </tr>
          </thead>
          <tbody>
            ${registryEntries.map((entry) => {
              const statusClass = entry.status === "verified" ? "success-high" : entry.status === "unverified" ? "success-med" : "success-low";
              const ownerShort = entry.owner.slice(0, 8) + "..." + entry.owner.slice(-4);
              const registeredTs = entry.registeredAt ? new Date(entry.registeredAt).getTime() : 0;
              const updatedTs = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
              const registeredDisplay = entry.registeredAt ? new Date(entry.registeredAt).toLocaleString() : "-";
              const updatedDisplay = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "-";
              // Parse URL into host and path
              let host = "";
              let path = "";
              try {
                const urlObj = new URL(entry.url);
                host = urlObj.host;
                path = urlObj.pathname + urlObj.search;
              } catch {
                host = entry.url;
                path = "";
              }
              // Determine explorer URL based on address prefix
              const explorerNetwork = entry.owner.startsWith("SP") ? "" : "?chain=testnet";
              const explorerUrl = "https://explorer.hiro.so/address/" + entry.owner + explorerNetwork;
              return `
                <tr data-owner="${entry.owner}" data-name="${entry.name}" data-url="${entry.url}" data-host="${host}" data-path="${path}" data-category="${entry.category || ""}" data-status="${entry.status}" data-registered="${registeredTs}" data-updated="${updatedTs}">
                  <td><a href="${explorerUrl}" target="_blank" class="owner-link" title="${entry.owner}">${ownerShort}</a></td>
                  <td><strong>${entry.name}</strong></td>
                  <td class="cat-${(entry.category || "").toLowerCase()}">${entry.category || "-"}</td>
                  <td><span class="host-badge">${host}</span></td>
                  <td><span class="path-code">${path.length > 30 ? path.slice(0, 30) + "..." : path}</span></td>
                  <td>
                    <button class="copy-btn" data-url="${entry.url}" title="Copy full URL">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </td>
                  <td class="${statusClass}">${entry.status}</td>
                  <td>${registeredDisplay}</td>
                  <td>${updatedDisplay}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
    ` : `
    <div id="x402-registry" class="chart-container" style="margin-top: 32px; text-align: center; padding: 40px;">
      <h2 class="section-title">X402 Endpoint Registry</h2>
      <p style="color: #71717a; margin-bottom: 16px;">No endpoints registered yet.</p>
      <p style="color: #a1a1aa; font-size: 13px;">Register your x402 endpoint via <code>/api/registry/register</code></p>
    </div>
    `}

    <div id="agent-registry" class="chart-container" style="margin-top: 32px; text-align: center; padding: 40px;">
      <h2 class="section-title">Agent Registry (ERC-8004)</h2>
      <p style="color: #71717a; margin-bottom: 16px;">AI agent identity and reputation registry.</p>
      <p style="color: #a1a1aa; font-size: 13px;">Register agents via <code>/api/agent/register</code> | View agents via <code>/api/agent/list</code></p>
    </div>

    <div class="footer">
      <p>
        <a href="/about">About X402</a> |
        <a href="/guide">Endpoint Guide</a> |
        <a href="/" target="_blank">API Docs</a> |
        Built on <a href="https://stacks.co" target="_blank">Stacks</a>
      </p>
    </div>
  </div>
  <script>
    (function() {
      // Generic table sorting function
      function setupTableSorting(tableSelector, numericKeys, defaultSort) {
        const table = document.querySelector(tableSelector);
        if (!table) return;

        const tbody = table.querySelector('tbody');
        const headers = table.querySelectorAll('th[data-sort]');
        let currentSort = { ...defaultSort };

        function sortTable(key) {
          const rows = Array.from(tbody.querySelectorAll('tr'));
          const isNumeric = numericKeys.includes(key);

          // Toggle direction if same column
          if (currentSort.key === key) {
            currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
          } else {
            currentSort.key = key;
            currentSort.dir = isNumeric ? 'desc' : 'asc';
          }

          rows.sort((a, b) => {
            let aVal = a.dataset[key];
            let bVal = b.dataset[key];

            if (isNumeric) {
              aVal = parseFloat(aVal) || 0;
              bVal = parseFloat(bVal) || 0;
              return currentSort.dir === 'asc' ? aVal - bVal : bVal - aVal;
            } else {
              return currentSort.dir === 'asc'
                ? (aVal || '').localeCompare(bVal || '')
                : (bVal || '').localeCompare(aVal || '');
            }
          });

          // Re-append sorted rows
          rows.forEach(row => tbody.appendChild(row));

          // Update header styles
          headers.forEach(th => {
            const icon = th.querySelector('.sort-icon');
            if (th.dataset.sort === key) {
              th.classList.add('sorted');
              icon.textContent = currentSort.dir === 'asc' ? '↑' : '↓';
            } else {
              th.classList.remove('sorted');
              icon.textContent = '↕';
            }
          });
        }

        headers.forEach(th => {
          th.addEventListener('click', () => sortTable(th.dataset.sort));
        });
      }

      // Setup endpoint metrics table sorting
      setupTableSorting(
        'table:not(#registry-table)',
        ['calls', 'success', 'latency', 'stx', 'sbtc', 'lastcall'],
        { key: 'calls', dir: 'desc' }
      );

      // Setup registry table sorting
      setupTableSorting(
        '#registry-table',
        ['registered', 'updated'],
        { key: 'registered', dir: 'desc' }
      );

      // Setup copy buttons
      document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const url = btn.dataset.url;
          if (!url) return;

          try {
            await navigator.clipboard.writeText(url);
            btn.classList.add('copied');
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg> Copied!';
            setTimeout(() => {
              btn.classList.remove('copied');
              btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy';
            }, 2000);
          } catch (err) {
            console.error('Failed to copy:', err);
          }
        });
      });
    })();
  </script>
</body>
</html>`;
}
