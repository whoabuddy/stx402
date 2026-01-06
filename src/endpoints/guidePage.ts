import type { Context } from "hono";

export function guideHandler(c: Context) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Getting started with STX402 payment-gated APIs">
  <title>Getting Started - STX402</title>
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
      font-size: 40px;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 16px;
    }
    .subtitle {
      font-size: 18px;
      color: var(--text-secondary);
      margin-bottom: 48px;
    }
    .step {
      margin-bottom: 48px;
    }
    .step-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .step-number {
      width: 40px;
      height: 40px;
      background: var(--accent);
      color: #000;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 18px;
      flex-shrink: 0;
    }
    h2 {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary);
    }
    p {
      color: var(--text-secondary);
      margin-bottom: 16px;
      font-size: 16px;
    }
    .code-block {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
      overflow-x: auto;
    }
    .code-block pre {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 14px;
      color: var(--text-primary);
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .code-block .comment { color: var(--text-muted); }
    .code-block .string { color: #4ade80; }
    .code-block .keyword { color: #c4b5fd; }
    .code-block .number { color: #06b6d4; }
    .code-block .property { color: var(--accent); }
    .response-example {
      background: #0c1f0c;
      border: 1px solid #166534;
    }
    .error-example {
      background: #1f0c0c;
      border: 1px solid #991b1b;
    }
    .info-box {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 4px solid var(--accent);
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
    }
    .info-box h4 {
      font-size: 14px;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 8px;
    }
    .info-box p {
      margin-bottom: 0;
      font-size: 14px;
    }
    .endpoint-list {
      display: grid;
      gap: 12px;
      margin: 16px 0;
    }
    .endpoint-item {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .method {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .method.get { background: #0891b2; color: #fff; }
    .method.post { background: #16a34a; color: #fff; }
    .endpoint-path {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      color: var(--text-primary);
    }
    .endpoint-desc {
      color: var(--text-muted);
      font-size: 12px;
      margin-left: auto;
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
      h1 { font-size: 28px; }
      .subtitle { font-size: 16px; }
      h2 { font-size: 20px; }
      .step-number { width: 32px; height: 32px; font-size: 14px; }
      .code-block { padding: 16px; }
      .code-block pre { font-size: 12px; }
      .endpoint-desc { display: none; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">402</div>
    <a href="/" class="header-title"><span class="accent">STX402</span></a>
    <nav class="header-nav">
      <a href="/about">About</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/">API Docs</a>
    </nav>
  </header>

  <div class="container">
    <h1>Getting Started</h1>
    <p class="subtitle">Make your first payment-gated API call in 3 steps.</p>

    <div class="step">
      <div class="step-header">
        <div class="step-number">1</div>
        <h2>Make a request</h2>
      </div>
      <p>Call any endpoint without authentication. The server will respond with HTTP 402 and payment instructions:</p>
      <div class="code-block">
        <pre><span class="keyword">curl</span> https://stx402.com/api/random/uuid</pre>
      </div>
      <p>Response (402 Payment Required):</p>
      <div class="code-block error-example">
        <pre>{
  <span class="property">"x402Version"</span>: <span class="number">1</span>,
  <span class="property">"accepts"</span>: [
    {
      <span class="property">"scheme"</span>: <span class="string">"exact"</span>,
      <span class="property">"network"</span>: <span class="string">"stacks-mainnet"</span>,
      <span class="property">"maxAmountRequired"</span>: <span class="string">"1000"</span>,
      <span class="property">"resource"</span>: <span class="string">"https://stx402.com/api/random/uuid"</span>,
      <span class="property">"payTo"</span>: <span class="string">"SP2..."</span>,
      <span class="property">"asset"</span>: <span class="string">"STX"</span>
    }
  ]
}</pre>
      </div>
    </div>

    <div class="step">
      <div class="step-header">
        <div class="step-number">2</div>
        <h2>Sign a payment</h2>
      </div>
      <p>Use the Stacks.js library to create a signed payment message. This doesn't send tokens yet—it just proves you can pay:</p>
      <div class="code-block">
        <pre><span class="keyword">import</span> { createX402Payment } <span class="keyword">from</span> <span class="string">'x402-js'</span>;

<span class="keyword">const</span> payment = <span class="keyword">await</span> createX402Payment({
  <span class="property">privateKey</span>: <span class="string">'your-private-key'</span>,
  <span class="property">payTo</span>: <span class="string">'SP2...'</span>,
  <span class="property">amount</span>: <span class="string">'1000'</span>,  <span class="comment">// microSTX</span>
  <span class="property">asset</span>: <span class="string">'STX'</span>,
  <span class="property">resource</span>: <span class="string">'https://stx402.com/api/random/uuid'</span>
});</pre>
      </div>
      <div class="info-box">
        <h4>Payment amounts</h4>
        <p>Amounts are in micro-units: 1000 microSTX = 0.001 STX. Most simple endpoints cost 0.001–0.01 STX per call.</p>
      </div>
    </div>

    <div class="step">
      <div class="step-header">
        <div class="step-number">3</div>
        <h2>Send the request with payment</h2>
      </div>
      <p>Include the signed payment in the X-PAYMENT header:</p>
      <div class="code-block">
        <pre><span class="keyword">curl</span> https://stx402.com/api/random/uuid \\
  -H <span class="string">"X-PAYMENT: <span class="property">\${payment}</span>"</span></pre>
      </div>
      <p>Success response (200 OK):</p>
      <div class="code-block response-example">
        <pre>{
  <span class="property">"uuid"</span>: <span class="string">"f47ac10b-58cc-4372-a567-0e02b2c3d479"</span>
}</pre>
      </div>
    </div>

    <div class="info-box">
      <h4>AI Agent Integration</h4>
      <p>Building an AI agent? The X402 protocol is designed for autonomous agents. Your agent can read the 402 response, sign payments, and make requests without any human intervention.</p>
    </div>

    <div class="step">
      <div class="step-header">
        <h2>Popular Endpoints</h2>
      </div>
      <p>Here are some endpoints to try:</p>
      <div class="endpoint-list">
        <div class="endpoint-item">
          <span class="method get">GET</span>
          <span class="endpoint-path">/api/random/uuid</span>
          <span class="endpoint-desc">Generate UUID</span>
        </div>
        <div class="endpoint-item">
          <span class="method get">GET</span>
          <span class="endpoint-path">/api/stacks/block-height</span>
          <span class="endpoint-desc">Current block</span>
        </div>
        <div class="endpoint-item">
          <span class="method post">POST</span>
          <span class="endpoint-path">/api/ai/summarize</span>
          <span class="endpoint-desc">AI summary</span>
        </div>
        <div class="endpoint-item">
          <span class="method post">POST</span>
          <span class="endpoint-path">/api/text/sha256</span>
          <span class="endpoint-desc">Hash text</span>
        </div>
        <div class="endpoint-item">
          <span class="method get">GET</span>
          <span class="endpoint-path">/api/stacks/get-bns-name/{address}</span>
          <span class="endpoint-desc">BNS lookup</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>
        <a href="/about">About</a> |
        <a href="/">API Docs</a> |
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
