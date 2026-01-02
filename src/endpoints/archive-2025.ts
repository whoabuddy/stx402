import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";

// Archive data structure (matches what the migration script creates)
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
  endpoints: Record<string, {
    calls: number;
    success: number;
    latencySum: number;
    earnings: { STX: number; sBTC: number; USDCx: number };
    lastCall: string;
  }>;
  daily: Record<string, { calls: number }>;
  topEndpoints: Array<{ path: string; calls: number; stx: number }>;
}

export class Archive2025Page extends OpenAPIRoute {
  schema = {
    tags: ["System"],
    summary: "View 2025 metrics archive (free)",
    responses: {
      "200": {
        description: "HTML archive page",
        content: {
          "text/html": {
            schema: { type: "string" as const },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    let archive: Archive2025 | null = null;

    if (c.env.METRICS) {
      archive = await c.env.METRICS.get<Archive2025>("metrics:archive:2025", "json");
    }

    const html = generateArchiveHTML(archive);
    return c.html(html);
  }
}

function generateArchiveHTML(archive: Archive2025 | null): string {
  if (!archive) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>STX402 - 2025 Archive</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e4e4e7;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container { max-width: 600px; text-align: center; }
    h1 { color: #f7931a; margin-bottom: 16px; }
    p { color: #71717a; margin-bottom: 24px; }
    a { color: #f7931a; }
  </style>
</head>
<body>
  <div class="container">
    <h1>2025 Archive Not Found</h1>
    <p>The 2025 metrics archive has not been created yet.</p>
    <p><a href="/dashboard">Back to Dashboard</a></p>
  </div>
</body>
</html>`;
  }

  // Sort daily data for chart
  const dailyEntries = Object.entries(archive.daily)
    .sort(([a], [b]) => a.localeCompare(b));

  // Group by month for the chart
  const monthlyData: Record<string, number> = {};
  for (const [date, stats] of dailyEntries) {
    const month = date.slice(0, 7); // YYYY-MM
    monthlyData[month] = (monthlyData[month] || 0) + stats.calls;
  }
  const months = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b));
  const maxMonthlyCalls = Math.max(...months.map(([, calls]) => calls), 1);

  // Category breakdown
  const categoryStats: Record<string, { calls: number; stx: number; count: number }> = {};
  for (const [path, stats] of Object.entries(archive.endpoints)) {
    const match = path.match(/^\/api\/([^/]+)/);
    const cat = match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : "Other";
    if (!categoryStats[cat]) {
      categoryStats[cat] = { calls: 0, stx: 0, count: 0 };
    }
    categoryStats[cat].calls += stats.calls;
    categoryStats[cat].stx += stats.earnings.STX;
    categoryStats[cat].count++;
  }
  const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1].calls - a[1].calls);

  // Format numbers
  const formatNumber = (n: number) => n.toLocaleString();
  const formatSTX = (n: number) => n.toFixed(4);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>STX402 - 2025 Year in Review</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(180deg, #0a0a0f 0%, #151520 100%);
      color: #e4e4e7;
      min-height: 100vh;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 48px;
      padding: 48px 24px;
      background: linear-gradient(135deg, rgba(247, 147, 26, 0.1) 0%, rgba(247, 147, 26, 0.02) 100%);
      border-radius: 24px;
      border: 1px solid rgba(247, 147, 26, 0.2);
    }
    .year-badge {
      display: inline-block;
      background: #f7931a;
      color: #000;
      padding: 8px 24px;
      border-radius: 100px;
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 16px;
      letter-spacing: 2px;
    }
    h1 {
      font-size: 48px;
      font-weight: 800;
      background: linear-gradient(135deg, #f7931a 0%, #fbbf24 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #71717a;
      font-size: 18px;
    }
    .hero-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 24px;
      margin: 48px 0;
    }
    .hero-stat {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
    }
    .hero-stat .value {
      font-size: 42px;
      font-weight: 800;
      color: #fff;
      line-height: 1;
    }
    .hero-stat .value.stx { color: #06b6d4; }
    .hero-stat .value.sbtc { color: #f7931a; }
    .hero-stat .label {
      color: #71717a;
      font-size: 14px;
      margin-top: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 24px;
      color: #fff;
    }
    .monthly-chart {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      height: 200px;
      padding: 16px 0;
    }
    .month-bar {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      height: 100%;
      justify-content: flex-end;
    }
    .bar {
      width: 100%;
      max-width: 60px;
      background: linear-gradient(180deg, #f7931a 0%, #c2410c 100%);
      border-radius: 4px 4px 0 0;
      min-height: 4px;
    }
    .bar-value {
      font-size: 11px;
      color: #a1a1aa;
      font-weight: 600;
    }
    .bar-label {
      font-size: 11px;
      color: #71717a;
    }
    .category-list {
      display: grid;
      gap: 12px;
    }
    .category-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .category-name {
      width: 80px;
      font-size: 14px;
      color: #a1a1aa;
      text-align: right;
    }
    .category-bar-track {
      flex: 1;
      height: 32px;
      background: #27272a;
      border-radius: 6px;
      overflow: hidden;
    }
    .category-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #f7931a 0%, #fb923c 100%);
      display: flex;
      align-items: center;
      padding-left: 12px;
      border-radius: 6px;
    }
    .category-bar-text {
      font-size: 12px;
      color: #fff;
      font-weight: 600;
      white-space: nowrap;
    }
    .category-count {
      width: 100px;
      font-size: 12px;
      color: #71717a;
    }
    .top-endpoints {
      display: grid;
      gap: 8px;
    }
    .endpoint-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: #27272a;
      border-radius: 8px;
    }
    .endpoint-rank {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #3f3f46;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
    }
    .endpoint-rank.gold { background: #f7931a; color: #000; }
    .endpoint-rank.silver { background: #a1a1aa; color: #000; }
    .endpoint-rank.bronze { background: #c2410c; color: #fff; }
    .endpoint-path {
      flex: 1;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      color: #e4e4e7;
    }
    .endpoint-calls {
      font-weight: 600;
      color: #fff;
    }
    .endpoint-stx {
      color: #06b6d4;
      font-size: 13px;
    }
    .footer {
      text-align: center;
      margin-top: 48px;
      color: #52525b;
      font-size: 14px;
    }
    .footer a { color: #f7931a; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .meta {
      text-align: center;
      color: #52525b;
      font-size: 12px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="year-badge">YEAR IN REVIEW</div>
      <h1>STX402 2025</h1>
      <p class="subtitle">A year of micropayments on Stacks</p>
    </div>

    <div class="hero-stats">
      <div class="hero-stat">
        <div class="value">${formatNumber(archive.summary.totalCalls)}</div>
        <div class="label">Total API Calls</div>
      </div>
      <div class="hero-stat">
        <div class="value stx">${formatSTX(archive.summary.totalEarnings.STX)}</div>
        <div class="label">STX Earned</div>
      </div>
      <div class="hero-stat">
        <div class="value sbtc">${archive.summary.totalEarnings.sBTC.toFixed(8)}</div>
        <div class="label">sBTC Earned</div>
      </div>
      <div class="hero-stat">
        <div class="value">${archive.summary.activeEndpoints}</div>
        <div class="label">Active Endpoints</div>
      </div>
      <div class="hero-stat">
        <div class="value">${archive.summary.avgSuccessRate.toFixed(1)}%</div>
        <div class="label">Avg Success Rate</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Monthly Activity</h2>
      <div class="monthly-chart">
        ${months.map(([month, calls]) => {
          const heightPct = Math.max((calls / maxMonthlyCalls) * 100, 2);
          const label = new Date(month + "-01").toLocaleDateString("en-US", { month: "short" });
          return `
            <div class="month-bar">
              <div class="bar-value">${formatNumber(calls)}</div>
              <div class="bar" style="height: ${heightPct}%"></div>
              <div class="bar-label">${label}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Calls by Category</h2>
      <div class="category-list">
        ${sortedCategories.slice(0, 10).map(([cat, stats]) => {
          const maxCalls = sortedCategories[0][1].calls;
          const widthPct = Math.max((stats.calls / maxCalls) * 100, 5);
          return `
            <div class="category-row">
              <div class="category-name">${cat}</div>
              <div class="category-bar-track">
                <div class="category-bar-fill" style="width: ${widthPct}%">
                  <span class="category-bar-text">${formatNumber(stats.calls)} calls</span>
                </div>
              </div>
              <div class="category-count">${formatSTX(stats.stx)} STX</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Top Endpoints</h2>
      <div class="top-endpoints">
        ${archive.topEndpoints.slice(0, 15).map((ep, i) => {
          const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
          return `
            <div class="endpoint-row">
              <div class="endpoint-rank ${rankClass}">${i + 1}</div>
              <div class="endpoint-path">${ep.path}</div>
              <div class="endpoint-calls">${formatNumber(ep.calls)}</div>
              <div class="endpoint-stx">${formatSTX(ep.stx)} STX</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <div class="footer">
      <p>
        <a href="/dashboard">View Live Dashboard</a> |
        Powered by <a href="https://x402.org" target="_blank">X402</a> |
        Built on <a href="https://stacks.co" target="_blank">Stacks</a>
      </p>
    </div>

    <p class="meta">
      Data exported: ${new Date(archive.exportedAt).toLocaleDateString()} |
      Period: ${archive.period.start} to ${archive.period.end}
    </p>
  </div>
</body>
</html>`;
}
