import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";
import { getNavCSS, getNavHTML } from "../components/nav";

export class AboutPage extends OpenAPIRoute {
  schema = {
    tags: ["System"],
    summary: "About X402 and STX402 (free)",
    responses: {
      "200": {
        description: "HTML about page",
        content: {
          "text/html": {
            schema: { type: "string" as const },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const html = generateAboutHTML();
    return c.html(html);
  }
}

function generateAboutHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About X402 - STX402</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://rsms.me/">
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
  <style>
    ${getNavCSS()}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e4e4e7;
      min-height: 100vh;
      line-height: 1.6;
    }
    .container { max-width: 1600px; margin: 0 auto; padding: 24px; }
    h1 .accent { color: #f7931a; }
    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #fafafa;
      margin-bottom: 8px;
    }
    .subtitle { color: #71717a; margin-bottom: 32px; font-size: 18px; }
    h2 {
      font-size: 22px;
      font-weight: 600;
      color: #fff;
      margin: 32px 0 16px;
      padding-top: 16px;
      border-top: 1px solid #27272a;
    }
    h2:first-of-type { border-top: none; margin-top: 0; padding-top: 0; }
    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #a1a1aa;
      margin: 24px 0 12px;
    }
    p { margin-bottom: 16px; color: #a1a1aa; }
    .highlight { color: #f7931a; font-weight: 500; }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
    }
    .flow-diagram {
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 14px;
    }
    .flow-step {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .step-num {
      background: #f7931a;
      color: #000;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      flex-shrink: 0;
    }
    .step-content {
      flex: 1;
      background: #27272a;
      padding: 12px 16px;
      border-radius: 8px;
    }
    .step-arrow {
      color: #52525b;
      font-size: 20px;
      margin-left: 6px;
    }
    .benefits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin: 24px 0;
    }
    .benefit {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 16px;
    }
    .benefit-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }
    .benefit h4 {
      color: #fff;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .benefit p {
      font-size: 13px;
      margin: 0;
    }
    .token-list {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin: 16px 0;
    }
    .token {
      background: #27272a;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
    }
    .token.stx { color: #06b6d4; border: 1px solid #164e63; }
    .token.sbtc { color: #f7931a; border: 1px solid #7c2d12; }
    .token.usdcx { color: #3b82f6; border: 1px solid #1e3a5f; }
    code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      background: #27272a;
      padding: 2px 6px;
      border-radius: 4px;
      color: #22d3ee;
    }
    .cta {
      display: inline-block;
      background: #f7931a;
      color: #000;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin: 8px 8px 8px 0;
      transition: background 0.15s;
    }
    .cta:hover { background: #fbbf24; }
    .cta.secondary {
      background: #27272a;
      color: #fff;
      border: 1px solid #3f3f46;
    }
    .cta.secondary:hover { background: #3f3f46; }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #27272a;
      text-align: center;
      color: #52525b;
      font-size: 13px;
    }
    .footer a { color: #f7931a; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    ul { margin: 16px 0; padding-left: 24px; }
    li { margin-bottom: 8px; color: #a1a1aa; }
    li::marker { color: #f7931a; }
  </style>
</head>
<body>
  ${getNavHTML("about")}
  <div class="container">
    <h1><span class="accent">STX402</span> About</h1>
    <p class="subtitle">Micropayments for APIs, powered by the Stacks blockchain</p>

    <h2>The Problem</h2>
    <p>
      Traditional API monetization is broken. You need API keys, billing accounts,
      subscription tiers, and credit cards. For a simple utility endpoint that costs
      fractions of a cent, the overhead is absurd.
    </p>

    <h2>The Solution: HTTP 402</h2>
    <p>
      HTTP has always had a <span class="highlight">402 Payment Required</span> status code,
      but it was "reserved for future use." That future is now.
    </p>
    <p>
      X402 is a protocol that lets APIs request payment inline with the request.
      No accounts. No API keys. Just <span class="highlight">pay-per-use</span> with crypto.
    </p>

    <div class="card">
      <h3>How It Works</h3>
      <div class="flow-diagram">
        <div class="flow-step">
          <div class="step-num">1</div>
          <div class="step-content">Client calls endpoint without payment</div>
        </div>
        <div class="step-arrow">&#8595;</div>
        <div class="flow-step">
          <div class="step-num">2</div>
          <div class="step-content">Server returns <code>402</code> with payment requirements (address, price, tokens)</div>
        </div>
        <div class="step-arrow">&#8595;</div>
        <div class="flow-step">
          <div class="step-num">3</div>
          <div class="step-content">Client signs payment, retries with <code>X-PAYMENT</code> header</div>
        </div>
        <div class="step-arrow">&#8595;</div>
        <div class="flow-step">
          <div class="step-num">4</div>
          <div class="step-content">Server verifies signature, settles payment, returns data</div>
        </div>
      </div>
    </div>

    <h3>Accepted Tokens</h3>
    <div class="token-list">
      <span class="token stx">STX</span>
      <span class="token sbtc">sBTC</span>
      <span class="token usdcx">USDCx</span>
    </div>
    <p>
      Payments settle on the <a href="https://stacks.co" target="_blank" style="color: #f7931a;">Stacks blockchain</a>,
      secured by Bitcoin.
    </p>

    <h2>The X402 Directory</h2>
    <p>
      STX402 is the <span class="highlight">directory layer</span> for the X402 ecosystem.
      It helps you discover endpoints and interact with agent identities on Stacks.
    </p>

    <div class="benefits-grid">
      <div class="benefit">
        <div class="benefit-icon">&#128218;</div>
        <h4>Endpoint Registry</h4>
        <p>Register and discover X402-compatible endpoints across the ecosystem.</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">&#129302;</div>
        <h4>Agent Identity</h4>
        <p>ERC-8004 agent registry interface - query agent metadata, URIs, and versions.</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">&#11088;</div>
        <h4>Agent Reputation</h4>
        <p>Track agent reputation scores and feedback on Stacks.</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">&#9989;</div>
        <h4>Agent Validation</h4>
        <p>Check validation status and requests for registered agents.</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">&#128279;</div>
        <h4>URL Shortener</h4>
        <p>Create short links with click tracking - useful for agents and services.</p>
      </div>
      <div class="benefit">
        <div class="benefit-icon">&#128274;</div>
        <h4>Ownership</h4>
        <p>Transfer endpoint ownership via SIP-018 signatures. Your endpoint, your rules.</p>
      </div>
    </div>

    <h2>Getting Started</h2>
    <p>To register your X402-enabled endpoint:</p>
    <ul>
      <li>Implement the X402 protocol on your endpoint (return 402 with payment requirements)</li>
      <li>Call <code>POST /registry/register</code> with your endpoint URL</li>
      <li>We'll probe your endpoint to verify it's real X402</li>
      <li>Your endpoint appears in the registry (pending verification)</li>
      <li>Once verified, it shows as trusted in the directory</li>
    </ul>

    <p>
      <a href="/docs" class="cta">View API Docs</a>
      <a href="/dashboard" class="cta secondary">See the Dashboard</a>
      <a href="/guide" class="cta secondary">Directory Guide</a>
    </p>

    <h2>Looking for Utilities?</h2>
    <p>
      General-purpose endpoints (hashing, storage, AI, Stacks utilities) are now on
      <a href="https://x402.aibtc.com" target="_blank" style="color: #f7931a;">x402.aibtc.com</a>.
      STX402 focuses on directory and identity services.
    </p>

    <h2>Learn More</h2>
    <ul>
      <li><a href="https://x402.org" target="_blank" style="color: #f7931a;">X402 Protocol Specification</a></li>
      <li><a href="https://x402.aibtc.com" target="_blank" style="color: #f7931a;">X402 AIBTC API (utilities)</a></li>
      <li><a href="https://stacks.co" target="_blank" style="color: #f7931a;">Stacks Blockchain</a></li>
      <li><a href="https://github.com/coinbase/x402" target="_blank" style="color: #f7931a;">X402 Reference Implementation</a></li>
    </ul>

    <div class="footer">
      <p>
        <a href="/dashboard">Dashboard</a> |
        <a href="/guide">Directory Guide</a> |
        <a href="/docs">API Docs</a> |
        Built on <a href="https://stacks.co" target="_blank">Stacks</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
