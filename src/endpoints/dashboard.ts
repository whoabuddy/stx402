import type { AppContext } from "../types";
import { ENDPOINT_TIERS } from "../utils/pricing";
import { getDashboardMetrics, type EndpointMetrics } from "../middleware/metrics";
import { listAllEntries, type RegistryEntryMinimal } from "../utils/registry";
import { getNavCSS, getNavHTML } from "../components/nav";
import { BaseEndpoint } from "./BaseEndpoint";

// Extract category from path (e.g., /registry/probe → Registry)
function getCategoryFromPath(path: string): string {
  const match = path.match(/^\/([^/]+)/);
  if (!match) return "Other";
  const cat = match[1];
  // Capitalize first letter
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export class Dashboard extends BaseEndpoint {
  schema = {
    tags: ["System"],
    summary: "View API metrics dashboard (free)",
    responses: {
      "200": {
        description: "HTML dashboard",
        content: {
          "text/html": {
            schema: { type: "string" },
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
        totalCalls: 0,
        successfulCalls: 0,
        avgLatencyMs: 0,
        successRate: "N/A",
        earnings: { STX: "0", sBTC: "0", USDCx: "0" },
        created: "Never",
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
  categoryStats: Record<string, { count: number; calls: number; stx: number }>;
  activeEndpoints: EndpointMetrics[];
  kvConfigured: boolean;
  registryEntries: RegistryEntryMinimal[];
}): string {
  const { metrics, dailyStats, totals, categoryStats, activeEndpoints, kvConfigured, registryEntries } = data;

  // Sort by total calls descending
  const sortedMetrics = [...metrics].sort((a, b) => b.totalCalls - a.totalCalls);

  // Calculate max for daily chart (use at least 1 to avoid division by zero)
  const maxDailyCalls = Math.max(...dailyStats.map((d) => d.calls), 1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>STX402 API Dashboard</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://rsms.me/">
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
  <style>
    ${getNavCSS()}
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
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 1600px; margin: 0 auto; padding: 24px; }
    h1 {
      font-size: 32px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    h1 .accent { color: var(--accent); }
    .subtitle { color: var(--text-muted); margin-bottom: 32px; font-size: 18px; }
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
      .container { padding: 16px; }
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
      .section-nav a { padding: 6px 10px; font-size: 11px; }
    }

    /* Hide less important columns on mobile */
    @media (max-width: 768px) {
      th:nth-child(6), td:nth-child(6),
      th:nth-child(7), td:nth-child(7),
      th:nth-child(8), td:nth-child(8) { display: none; }
    }
  </style>
</head>
<body>
  ${getNavHTML("dashboard")}
  <div class="container">
    <h1><span class="accent">STX402</span> Dashboard</h1>
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
      </div>
      <div class="card">
        <h3>Total Calls</h3>
        <div class="value">${totals.calls.toLocaleString()}</div>
      </div>
      <div class="card">
        <h3>STX Earned</h3>
        <div class="value stx">${totals.stx.toFixed(6)}</div>
      </div>
      <div class="card">
        <h3>Sats Earned</h3>
        <div class="value sbtc">${Math.round(totals.sbtc * 100_000_000).toLocaleString()}</div>
      </div>
      <div class="card">
        <h3>USDCx Earned</h3>
        <div class="value usdcx">${totals.usdcx.toFixed(2)}</div>
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

    <h2 id="endpoint-metrics" class="section-title">STX402 Endpoint Metrics</h2>
    <div class="table-container">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th data-sort="path">Endpoint <span class="sort-icon">↕</span></th>
              <th data-sort="category">Category <span class="sort-icon">↕</span></th>
              <th data-sort="calls" class="sorted">Calls <span class="sort-icon">↓</span></th>
              <th data-sort="latency">Latency <span class="sort-icon">↕</span></th>
              <th data-sort="stx">STX <span class="sort-icon">↕</span></th>
              <th data-sort="sbtc">sBTC <span class="sort-icon">↕</span></th>
              <th data-sort="created">Created <span class="sort-icon">↕</span></th>
              <th data-sort="lastcall">Last Call <span class="sort-icon">↕</span></th>
            </tr>
          </thead>
          <tbody>
            ${sortedMetrics.map((m) => {
              const category = getCategoryFromPath(m.path);
              const createdTs = m.created === "Never" ? 0 : new Date(m.created).getTime();
              const createdDisplay =
                m.created === "Never"
                  ? "-"
                  : new Date(m.created).toLocaleDateString();
              const lastCallTs = m.lastCall === "Never" ? 0 : new Date(m.lastCall).getTime();
              const lastCallDisplay =
                m.lastCall === "Never"
                  ? "-"
                  : new Date(m.lastCall).toLocaleString();
              return `
                <tr data-path="${m.path}" data-category="${category}" data-calls="${m.totalCalls}" data-latency="${m.avgLatencyMs}" data-stx="${m.earnings.STX}" data-sbtc="${m.earnings.sBTC}" data-created="${createdTs}" data-lastcall="${lastCallTs}">
                  <td><code>${m.path}</code></td>
                  <td class="cat-${category.toLowerCase()}">${category}</td>
                  <td>${m.totalCalls.toLocaleString()}</td>
                  <td>${m.avgLatencyMs}ms</td>
                  <td>${m.earnings.STX}</td>
                  <td>${m.earnings.sBTC}</td>
                  <td>${createdDisplay}</td>
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
      <p style="color: #a1a1aa; font-size: 13px;">Register your X402 endpoint via <code>POST /registry/register</code></p>
    </div>
    `}

    <div id="agent-registry" class="chart-container" style="margin-top: 32px; text-align: center; padding: 40px;">
      <h2 class="section-title">Agent Registry (ERC-8004)</h2>
      <p style="color: #71717a; margin-bottom: 16px;">Query AI agent identity, reputation, and validation on Stacks.</p>
      <p style="color: #a1a1aa; font-size: 13px;">
        <code>GET /agent/registry</code> (free) |
        <code>POST /agent/info</code> |
        <code>POST /agent/lookup</code>
      </p>
    </div>

    <div class="footer">
      <p>
        <a href="/guide">Endpoint Guide</a> |
        <a href="/docs">API Docs</a> |
        <a href="/toolbox">Toolbox</a> |
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
        ['calls', 'latency', 'stx', 'sbtc', 'lastcall'],
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
