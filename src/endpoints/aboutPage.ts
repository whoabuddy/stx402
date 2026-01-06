import type { Context } from "hono";

export function aboutHandler(c: Context) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="STX402 - Payment-gated APIs powered by X402 protocol on Stacks">
  <title>About STX402</title>
  <link rel="preconnect" href="https://rsms.me/">
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
  <link rel="shortcut icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23f7931a' rx='12' width='100' height='100'/><text x='50' y='68' font-size='40' font-weight='800' text-anchor='middle' fill='%23000'>402</text></svg>">
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
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      line-height: 1.6;
    }
    .header {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 16px 32px;
      display: flex;
      align-items: center;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 100;
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
      flex-shrink: 0;
    }
    .header-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.02em;
      text-decoration: none;
    }
    .header-title .accent { color: var(--accent); }
    .header-nav {
      margin-left: auto;
      display: flex;
      gap: 8px;
    }
    .header-nav a {
      background: var(--bg-hover);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    .header-nav a:hover {
      border-color: var(--border-hover);
      color: var(--text-primary);
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 64px 32px;
    }
    h1 {
      font-size: 48px;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 24px;
      background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .tagline {
      font-size: 24px;
      color: var(--text-secondary);
      margin-bottom: 48px;
      line-height: 1.4;
    }
    .tagline .highlight {
      color: var(--accent);
      font-weight: 600;
    }
    .section {
      margin-bottom: 48px;
    }
    h2 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--text-primary);
    }
    p {
      color: var(--text-secondary);
      margin-bottom: 16px;
      font-size: 16px;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 24px;
    }
    .feature-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      transition: all 0.2s ease;
    }
    .feature-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }
    .feature-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
    .feature-card h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-primary);
    }
    .feature-card p {
      font-size: 14px;
      margin-bottom: 0;
    }
    .token-grid {
      display: flex;
      gap: 16px;
      margin-top: 24px;
      flex-wrap: wrap;
    }
    .token {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .token-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
    }
    .token-icon.stx { background: #06b6d4; color: #000; }
    .token-icon.sbtc { background: var(--accent); color: #000; }
    .token-icon.usdcx { background: #3b82f6; color: #fff; }
    .token-name {
      font-weight: 600;
      color: var(--text-primary);
    }
    .token-desc {
      font-size: 13px;
      color: var(--text-muted);
    }
    .cta-section {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      margin-top: 64px;
    }
    .cta-section h2 {
      margin-bottom: 12px;
    }
    .cta-section p {
      margin-bottom: 24px;
    }
    .cta-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: var(--accent);
      color: #000;
    }
    .btn-primary:hover {
      background: #c2410c;
    }
    .btn-secondary {
      background: var(--bg-hover);
      border: 1px solid var(--border);
      color: var(--text-primary);
    }
    .btn-secondary:hover {
      border-color: var(--border-hover);
    }
    .footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
    .footer a { color: var(--accent); text-decoration: none; }

    @media (max-width: 600px) {
      .header { padding: 12px 16px; }
      .logo { width: 32px; height: 32px; font-size: 12px; }
      .header-title { font-size: 16px; }
      .header-nav a { padding: 6px 12px; font-size: 12px; }
      .container { padding: 32px 16px; }
      h1 { font-size: 32px; }
      .tagline { font-size: 18px; }
      h2 { font-size: 20px; }
      .cta-section { padding: 24px; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">402</div>
    <a href="/" class="header-title"><span class="accent">STX402</span></a>
    <nav class="header-nav">
      <a href="/guide">Guide</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">API Docs</a>
    </nav>
  </header>

  <div class="container">
    <h1>Pay-per-call APIs for the AI era</h1>
    <p class="tagline">
      STX402 implements the <span class="highlight">X402 protocol</span> on Stacks,
      enabling instant micropayments for API calls using Bitcoin-backed tokens.
    </p>

    <div class="section">
      <h2>What is X402?</h2>
      <p>
        X402 is a standard for payment-gated HTTP APIs. When you call an endpoint,
        the server responds with HTTP 402 (Payment Required) and tells you exactly
        how much to pay and where. Include the payment proof in your next request,
        and get your response instantly.
      </p>
      <p>
        No accounts. No API keys. No subscriptions. Just pay for what you use.
      </p>
    </div>

    <div class="section">
      <h2>Why it matters</h2>
      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <h3>AI Agent Ready</h3>
          <p>Autonomous agents can pay for services without human intervention or credit cards.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Instant Settlement</h3>
          <p>Payments settle on Stacks in seconds, not days. No chargebacks.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🌍</div>
          <h3>Global Access</h3>
          <p>Anyone with crypto can use the API. No bank account required.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💰</div>
          <h3>True Micropayments</h3>
          <p>Pay fractions of a cent per call. Only pay for what you use.</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Accepted Tokens</h2>
      <p>Pay with any of these Stacks-based tokens:</p>
      <div class="token-grid">
        <div class="token">
          <div class="token-icon stx">STX</div>
          <div>
            <div class="token-name">STX</div>
            <div class="token-desc">Native Stacks token</div>
          </div>
        </div>
        <div class="token">
          <div class="token-icon sbtc">₿</div>
          <div>
            <div class="token-name">sBTC</div>
            <div class="token-desc">Bitcoin on Stacks</div>
          </div>
        </div>
        <div class="token">
          <div class="token-icon usdcx">$</div>
          <div>
            <div class="token-name">USDCx</div>
            <div class="token-desc">USD stablecoin</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>100+ Endpoints</h2>
      <p>
        From Stacks blockchain queries to AI text processing, image generation,
        cryptographic utilities, and more. Every endpoint is instantly accessible
        with a simple payment.
      </p>
    </div>

    <div class="cta-section">
      <h2>Ready to build?</h2>
      <p>Start making API calls in minutes. No signup required.</p>
      <div class="cta-buttons">
        <a href="/guide" class="btn btn-primary">Get Started</a>
        <a href="/" class="btn btn-secondary">View API Docs</a>
      </div>
    </div>

    <div class="footer">
      <p>
        <a href="/about">About</a> |
        <a href="/guide">Guide</a> |
        <a href="/dashboard">Dashboard</a> |
        Powered by <a href="https://x402.org" target="_blank">X402</a> |
        Built on <a href="https://stacks.co" target="_blank">Stacks</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return c.html(html);
}
