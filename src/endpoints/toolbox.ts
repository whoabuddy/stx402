import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";
import { getNavCSS, getNavHTML } from "../components/nav";

export class ToolboxPage extends OpenAPIRoute {
  schema = {
    tags: ["System"],
    summary: "Interactive toolbox for curious developers (free)",
    responses: {
      "200": {
        description: "HTML page",
        content: { "text/html": { schema: { type: "string" as const } } },
      },
    },
  };

  async handle(c: AppContext) {
    const html = generateToolboxHTML();
    return c.html(html);
  }
}

function generateToolboxHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Toolbox - STX402</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23f7931a' rx='8' width='100' height='100'/><text x='50' y='68' font-size='40' font-weight='800' text-anchor='middle' fill='%23000'>402</text></svg>">
  <link rel="preconnect" href="https://rsms.me/">
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
  <style>
    ${getNavCSS()}

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #09090b;
      color: #fafafa;
      min-height: 100vh;
      line-height: 1.5;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 48px 24px;
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #fafafa;
      margin-bottom: 8px;
    }

    h1 .accent {
      color: #f7931a;
    }

    .subtitle {
      color: #71717a;
      margin-bottom: 32px;
      font-size: 18px;
    }

    .tool-card {
      background: #0f0f12;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
    }

    .tool-card:last-child {
      margin-bottom: 0;
    }

    .tool-card h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .tool-card h2::before {
      content: "🔍";
    }

    .tool-card > p {
      color: #a1a1aa;
      font-size: 14px;
      margin-bottom: 24px;
    }

    .input-group {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }

    .input-group input[type="url"] {
      flex: 1;
      min-width: 0;
      padding: 12px 16px;
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #fafafa;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.15s ease;
    }

    .input-group input[type="url"]:focus {
      outline: none;
      border-color: #f7931a;
    }

    .input-group input[type="url"]::placeholder {
      color: #71717a;
    }

    .input-group select {
      padding: 12px 16px;
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #a1a1aa;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }

    .input-group select:focus {
      outline: none;
      border-color: #f7931a;
    }

    .input-group button {
      padding: 12px 24px;
      background: linear-gradient(135deg, #f7931a 0%, #c2410c 100%);
      border: none;
      border-radius: 8px;
      color: #000;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s ease, transform 0.15s ease;
      white-space: nowrap;
    }

    .input-group button:hover {
      opacity: 0.9;
    }

    .input-group button:active {
      transform: scale(0.98);
    }

    .input-group button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (max-width: 600px) {
      .input-group {
        flex-direction: column;
      }
      .input-group select {
        width: 100%;
      }
    }

    /* Results section */
    .results {
      display: none;
    }

    .results.visible {
      display: block;
    }

    .results-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .status-badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    .status-badge.payment-required {
      background: rgba(247, 147, 26, 0.15);
      color: #f7931a;
    }

    .status-badge.free {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    .status-badge.error {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .checked-url {
      font-size: 13px;
      color: #71717a;
      font-family: 'SF Mono', Monaco, monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .human-friendly {
      background: #18181b;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }

    .human-friendly h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .human-friendly p {
      color: #a1a1aa;
      font-size: 14px;
      line-height: 1.6;
    }

    .human-friendly .price-highlight {
      color: #f7931a;
      font-weight: 600;
    }

    .human-friendly .tokens-accepted {
      margin-top: 12px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .token-chip {
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 4px;
      font-size: 12px;
      color: #a1a1aa;
      font-family: 'SF Mono', Monaco, monospace;
    }

    /* Dev details collapsible */
    .dev-details {
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      overflow: hidden;
    }

    .dev-details summary {
      padding: 12px 16px;
      background: #18181b;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: #a1a1aa;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
    }

    .dev-details summary:hover {
      color: #fafafa;
    }

    .dev-details summary::marker {
      content: "";
    }

    .dev-details summary::before {
      content: "▶";
      font-size: 10px;
      transition: transform 0.15s ease;
    }

    .dev-details[open] summary::before {
      transform: rotate(90deg);
    }

    .dev-details-content {
      padding: 16px;
      background: #0f0f12;
    }

    .dev-details pre {
      background: #18181b;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 12px;
      font-family: 'SF Mono', Monaco, monospace;
      line-height: 1.5;
      color: #a1a1aa;
    }

    .copy-btn {
      margin-top: 8px;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.06);
      border: none;
      border-radius: 4px;
      color: #a1a1aa;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fafafa;
    }

    .copy-btn.copied {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    /* Loading state */
    .loading {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #a1a1aa;
      font-size: 14px;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-top-color: #f7931a;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Free endpoint message */
    .free-message {
      color: #22c55e;
    }

    .error-message {
      color: #ef4444;
    }

    /* Footer hint */
    .tool-footer {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 13px;
      color: #71717a;
    }

    .tool-footer a {
      color: #f7931a;
      text-decoration: none;
    }

    .tool-footer a:hover {
      text-decoration: underline;
    }

    /* Call Endpoint Tool */
    .wallet-status {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding: 16px;
      background: #18181b;
      border-radius: 8px;
    }

    .wallet-status .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
    }

    .wallet-status.connected .status-dot {
      background: #22c55e;
    }

    .wallet-status .status-text {
      flex: 1;
      font-size: 14px;
      color: #a1a1aa;
    }

    .wallet-status.connected .status-text {
      color: #fafafa;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
    }

    .wallet-status button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .wallet-status .connect-btn {
      background: linear-gradient(135deg, #f7931a 0%, #c2410c 100%);
      color: #000;
    }

    .wallet-status .connect-btn:hover {
      opacity: 0.9;
    }

    .wallet-status .connect-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .wallet-status .disconnect-btn {
      background: rgba(255, 255, 255, 0.06);
      color: #a1a1aa;
    }

    .wallet-status .disconnect-btn:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .call-form {
      display: none;
    }

    .call-form.visible {
      display: block;
    }

    .call-form .form-row {
      margin-bottom: 16px;
    }

    .call-form label {
      display: block;
      font-size: 13px;
      color: #a1a1aa;
      margin-bottom: 8px;
    }

    .call-form textarea {
      width: 100%;
      min-height: 80px;
      padding: 12px;
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #fafafa;
      font-size: 13px;
      font-family: 'SF Mono', Monaco, monospace;
      resize: vertical;
    }

    .call-form textarea:focus {
      outline: none;
      border-color: #f7931a;
    }

    .call-btn {
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #f7931a 0%, #c2410c 100%);
      border: none;
      border-radius: 8px;
      color: #000;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .call-btn:hover {
      opacity: 0.9;
    }

    .call-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .call-response {
      margin-top: 24px;
      display: none;
    }

    .call-response.visible {
      display: block;
    }

    .call-response pre {
      background: #18181b;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
      font-family: 'SF Mono', Monaco, monospace;
      line-height: 1.5;
      color: #a1a1aa;
      max-height: 400px;
    }

    .not-connected-msg {
      text-align: center;
      padding: 32px;
      color: #71717a;
      font-size: 14px;
    }
  </style>
</head>
<body>
  ${getNavHTML("toolbox")}

  <div class="container">
    <h1><span class="accent">STX402</span> Toolbox</h1>
    <p class="subtitle">Interactive tools for the curious</p>

    <div class="tool-card">
      <h2>402 Checker</h2>
      <p>Test any URL to see if it requires X402 payment</p>

      <div class="input-group">
        <input type="url" id="url-input" placeholder="https://stx402.com/api/..." autocomplete="off">
        <select id="quick-select">
          <option value="">Quick select</option>
          <optgroup label="Text (0.001 STX)">
            <option value="/api/text/base64-encode">base64-encode</option>
            <option value="/api/text/sha256">sha256</option>
            <option value="/api/text/word-count">word-count</option>
          </optgroup>
          <optgroup label="Stacks (0.001 STX)">
            <option value="/api/stacks/bns-address">bns-address</option>
            <option value="/api/stacks/contract-source">contract-source</option>
            <option value="/api/stacks/stx-balance">stx-balance</option>
          </optgroup>
          <optgroup label="AI (0.003 STX)">
            <option value="/api/ai/summarize">summarize</option>
            <option value="/api/ai/sentiment">sentiment</option>
          </optgroup>
          <optgroup label="Storage (0.0005-0.001 STX)">
            <option value="/api/kv/get">kv/get</option>
            <option value="/api/kv/set">kv/set</option>
          </optgroup>
          <optgroup label="Random (0.001 STX)">
            <option value="/api/random/uuid">uuid</option>
            <option value="/api/random/password">password</option>
          </optgroup>
        </select>
        <button id="check-btn">Check</button>
      </div>

      <div class="results" id="results">
        <!-- Populated by JavaScript -->
      </div>

      <div class="tool-footer">
        Learn more about <a href="/about">X402 payments</a> or browse the <a href="/guide">endpoint guide</a>.
      </div>
    </div>

    <div class="tool-card">
      <h2 style="display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">&#9889;</span> Call an Endpoint</h2>
      <p>Connect your wallet and make a paid API call</p>

      <div class="wallet-status" id="wallet-status">
        <div class="status-dot"></div>
        <div class="status-text">Not connected</div>
        <button class="connect-btn" id="connect-btn">Connect Wallet</button>
      </div>

      <div class="call-form" id="call-form">
        <div class="form-row">
          <label>Endpoint URL</label>
          <div class="input-group" style="margin-bottom:0;">
            <input type="url" id="call-url" placeholder="https://stx402.com/api/..." autocomplete="off">
            <select id="call-quick-select">
              <option value="">Quick select</option>
              <optgroup label="Text (0.001 STX)">
                <option value="/api/text/base64-encode">base64-encode (POST)</option>
                <option value="/api/text/sha256">sha256 (POST)</option>
              </optgroup>
              <optgroup label="Random (0.001 STX)">
                <option value="/api/random/uuid">uuid (GET)</option>
                <option value="/api/random/password">password (GET)</option>
              </optgroup>
              <optgroup label="Stacks (0.001 STX)">
                <option value="/api/stacks/block-height">block-height (GET)</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div class="form-row">
          <label>Request Body (for POST endpoints, optional)</label>
          <textarea id="call-body" placeholder='{"text": "Hello World"}'></textarea>
        </div>

        <button class="call-btn" id="call-btn">Call Endpoint</button>
      </div>

      <div class="not-connected-msg" id="not-connected-msg">
        Connect your wallet above to make paid API calls
      </div>

      <div class="call-response" id="call-response">
        <div class="results-header">
          <span class="status-badge" id="call-status-badge">200</span>
          <span class="checked-url" id="call-response-url"></span>
        </div>
        <pre id="call-response-body"></pre>
      </div>
    </div>
  </div>

  <script>
    const urlInput = document.getElementById('url-input');
    const quickSelect = document.getElementById('quick-select');
    const checkBtn = document.getElementById('check-btn');
    const results = document.getElementById('results');

    // Quick select populates URL input
    quickSelect.addEventListener('change', function() {
      if (this.value) {
        urlInput.value = window.location.origin + this.value;
        this.value = '';
      }
    });

    // Enter key triggers check
    urlInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        checkBtn.click();
      }
    });

    // Check button
    checkBtn.addEventListener('click', async function() {
      let url = urlInput.value.trim();
      if (!url) {
        urlInput.focus();
        return;
      }

      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
        urlInput.value = url;
      }

      // Show loading
      results.classList.add('visible');
      results.innerHTML = '<div class="loading"><div class="spinner"></div>Checking...</div>';
      checkBtn.disabled = true;

      try {
        // Check if same origin
        const urlObj = new URL(url);
        const isSameOrigin = urlObj.origin === window.location.origin;

        if (isSameOrigin) {
          // Same origin: can read headers
          const res = await fetch(url, { method: 'GET' });
          displayResult(url, res);
        } else {
          // Cross-origin: try with mode cors, handle errors gracefully
          try {
            const res = await fetch(url, { method: 'GET', mode: 'cors' });
            displayResult(url, res);
          } catch (corsError) {
            // CORS blocked - can't read response
            displayCorsBlocked(url);
          }
        }
      } catch (err) {
        displayError(url, err.message);
      } finally {
        checkBtn.disabled = false;
      }
    });

    function displayResult(url, res) {
      const status = res.status;
      const x402Header = res.headers.get('X-402');

      let html = '<div class="results-header">';

      if (status === 402 && x402Header) {
        // Payment required
        html += '<span class="status-badge payment-required">402 Payment Required</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';

        try {
          const x402 = JSON.parse(x402Header);
          html += renderPaymentDetails(x402);
        } catch (e) {
          html += '<div class="human-friendly"><p>Could not parse X-402 header</p></div>';
        }
      } else if (status >= 200 && status < 300) {
        // Free / successful
        html += '<span class="status-badge free">✓ Free / No Payment</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';
        html += '<div class="human-friendly"><p class="free-message">This endpoint returned ' + status + ' without requiring payment.</p></div>';
      } else {
        // Other status
        html += '<span class="status-badge error">' + status + '</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';
        html += '<div class="human-friendly"><p class="error-message">Received HTTP ' + status + ' response.</p></div>';
      }

      results.innerHTML = html;
      setupCopyButtons();
    }

    function renderPaymentDetails(x402) {
      // Parse the X-402 format
      // Format: { accepts: [{scheme, network, maxAmount, resource, payTo, ...}], ...}
      let html = '<div class="human-friendly">';

      if (x402.accepts && x402.accepts.length > 0) {
        const first = x402.accepts[0];
        const amount = first.maxAmountRequired || first.maxAmount;
        const amountNum = amount ? (parseInt(amount) / 1000000).toFixed(6) : '?';

        // Determine token from asset or default to STX
        let token = 'STX';
        if (first.asset) {
          if (first.asset.includes('sbtc')) token = 'sBTC';
          else if (first.asset.includes('usdc')) token = 'USDCx';
        }

        html += '<h3>Payment Required</h3>';
        html += '<p>This endpoint costs <span class="price-highlight">' + amountNum + ' ' + token + '</span> per request.</p>';

        // Show all accepted tokens
        const tokens = x402.accepts.map(a => {
          if (a.asset) {
            if (a.asset.includes('sbtc')) return 'sBTC';
            if (a.asset.includes('usdc')) return 'USDCx';
            return a.asset.split('::')[1] || a.asset;
          }
          return 'STX';
        });
        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length > 0) {
          html += '<div class="tokens-accepted">';
          html += '<span style="color:#71717a;font-size:12px;">Accepts:</span>';
          uniqueTokens.forEach(t => {
            html += '<span class="token-chip">' + t + '</span>';
          });
          html += '</div>';
        }
      } else {
        html += '<p>Payment required but no payment options found in header.</p>';
      }

      html += '</div>';

      // Dev details
      html += '<details class="dev-details">';
      html += '<summary>Developer Details</summary>';
      html += '<div class="dev-details-content">';
      html += '<pre id="x402-json">' + escapeHtml(JSON.stringify(x402, null, 2)) + '</pre>';
      html += '<button class="copy-btn" data-copy="x402-json">Copy JSON</button>';
      html += '</div></details>';

      return html;
    }

    function displayCorsBlocked(url) {
      let html = '<div class="results-header">';
      html += '<span class="status-badge error">CORS Blocked</span>';
      html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
      html += '</div>';
      html += '<div class="human-friendly">';
      html += '<p class="error-message">Cannot check this URL due to browser security restrictions (CORS).</p>';
      html += '<p style="margin-top:8px;color:#71717a;font-size:13px;">Try checking URLs from stx402.com, or use <code style="background:#18181b;padding:2px 6px;border-radius:4px;">curl -I ' + escapeHtml(url) + '</code> from your terminal.</p>';
      html += '</div>';
      results.innerHTML = html;
    }

    function displayError(url, message) {
      let html = '<div class="results-header">';
      html += '<span class="status-badge error">Error</span>';
      html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
      html += '</div>';
      html += '<div class="human-friendly">';
      html += '<p class="error-message">' + escapeHtml(message) + '</p>';
      html += '</div>';
      results.innerHTML = html;
    }

    function setupCopyButtons() {
      document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
        btn.addEventListener('click', async function() {
          const targetId = this.dataset.copy;
          const target = document.getElementById(targetId);
          if (target) {
            await navigator.clipboard.writeText(target.textContent);
            this.textContent = 'Copied!';
            this.classList.add('copied');
            setTimeout(() => {
              this.textContent = 'Copy JSON';
              this.classList.remove('copied');
            }, 2000);
          }
        });
      });
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  </script>

  <!-- Stacks Connect for wallet authentication -->
  <script src="https://cdn.jsdelivr.net/npm/@stacks/connect@8/dist/index.global.js"></script>
  <script>
    // Call Endpoint tool elements
    const walletStatus = document.getElementById('wallet-status');
    const callForm = document.getElementById('call-form');
    const notConnectedMsg = document.getElementById('not-connected-msg');
    const callUrl = document.getElementById('call-url');
    const callQuickSelect = document.getElementById('call-quick-select');
    const callBody = document.getElementById('call-body');
    const callBtn = document.getElementById('call-btn');
    const callResponse = document.getElementById('call-response');
    const callStatusBadge = document.getElementById('call-status-badge');
    const callResponseUrl = document.getElementById('call-response-url');
    const callResponseBody = document.getElementById('call-response-body');

    let connectedAddress = null;

    // Truncate address for display
    function truncateAddress(address) {
      if (!address || address.length < 12) return address;
      return address.slice(0, 5) + '...' + address.slice(-5);
    }

    // Update wallet UI based on connection state
    function updateWalletUI() {
      const { isConnected, getLocalStorage } = StacksConnect;

      if (isConnected()) {
        const data = getLocalStorage();
        connectedAddress = data?.addresses?.stx?.[0]?.address;

        if (connectedAddress) {
          walletStatus.classList.add('connected');
          walletStatus.innerHTML = \`
            <div class="status-dot"></div>
            <div class="status-text">\${truncateAddress(connectedAddress)}</div>
            <button class="disconnect-btn" id="disconnect-btn">Disconnect</button>
          \`;

          document.getElementById('disconnect-btn').addEventListener('click', handleDisconnect);

          // Show call form, hide message
          callForm.classList.add('visible');
          notConnectedMsg.style.display = 'none';
          return;
        }
      }

      // Not connected
      connectedAddress = null;
      walletStatus.classList.remove('connected');
      walletStatus.innerHTML = \`
        <div class="status-dot"></div>
        <div class="status-text">Not connected</div>
        <button class="connect-btn" id="connect-btn">Connect Wallet</button>
      \`;

      document.getElementById('connect-btn').addEventListener('click', handleConnect);

      // Hide call form, show message
      callForm.classList.remove('visible');
      notConnectedMsg.style.display = 'block';
      callResponse.classList.remove('visible');
    }

    // Handle connect
    async function handleConnect() {
      const { connect } = StacksConnect;
      const btn = document.getElementById('connect-btn');

      btn.disabled = true;
      btn.textContent = 'Connecting...';

      try {
        await connect();
        updateWalletUI();
      } catch (err) {
        console.error('Wallet connect error:', err);
        btn.disabled = false;
        btn.textContent = 'Connect Wallet';
      }
    }

    // Handle disconnect
    function handleDisconnect() {
      const { disconnect } = StacksConnect;
      disconnect();
      updateWalletUI();
    }

    // Quick select for call form
    callQuickSelect.addEventListener('change', function() {
      if (this.value) {
        callUrl.value = window.location.origin + this.value;
        this.value = '';
      }
    });

    // Handle call endpoint
    callBtn.addEventListener('click', async function() {
      let url = callUrl.value.trim();
      if (!url) {
        callUrl.focus();
        return;
      }

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
        callUrl.value = url;
      }

      callBtn.disabled = true;
      callBtn.textContent = 'Checking...';
      callResponse.classList.remove('visible');

      try {
        // Determine method based on body
        const bodyText = callBody.value.trim();
        const hasBody = bodyText.length > 0;
        const method = hasBody ? 'POST' : 'GET';

        // First request - will return 402 with payment requirements
        const options = {
          method,
          headers: { 'Content-Type': 'application/json' }
        };
        if (hasBody) {
          options.body = bodyText;
        }

        const res = await fetch(url, options);
        const status = res.status;

        if (status === 402) {
          // Got payment requirements - parse them
          const paymentReq = await res.json();
          const amount = paymentReq.maxAmountRequired;
          const amountNum = amount ? (parseInt(amount) / 1000000).toFixed(6) : '?';
          const payTo = paymentReq.payTo;
          const tokenType = paymentReq.tokenType || 'STX';

          callStatusBadge.className = 'status-badge payment-required';
          callStatusBadge.textContent = '402 Payment Required';
          callResponseUrl.textContent = url;

          // Show payment info
          callResponseBody.innerHTML = \`
<div style="margin-bottom:16px;">
  <strong>Cost:</strong> <span style="color:#f7931a;font-weight:600;">\${amountNum} \${tokenType}</span>
</div>
<div style="margin-bottom:16px;">
  <strong>Recipient:</strong> <code style="background:#27272a;padding:2px 6px;border-radius:4px;font-size:12px;">\${payTo}</code>
</div>
<div style="margin-bottom:16px;">
  <strong>Network:</strong> \${paymentReq.network}
</div>
<div style="padding:16px;background:#18181b;border-radius:8px;margin-top:16px;">
  <p style="color:#a1a1aa;font-size:13px;margin-bottom:8px;">
    To call this endpoint, use the <a href="https://www.npmjs.com/package/x402-stacks" target="_blank" style="color:#f7931a;">x402-stacks</a> client library
    which handles payment signing and verification.
  </p>
  <p style="color:#71717a;font-size:12px;">
    Browser wallet signing (without broadcast) is not yet supported by @stacks/connect.
  </p>
</div>
\`;

        } else {
          // Got response (free endpoint or already paid)
          callStatusBadge.className = status >= 200 && status < 300 ? 'status-badge free' : 'status-badge error';
          callStatusBadge.textContent = status;
          callResponseUrl.textContent = url;

          try {
            const data = await res.json();
            callResponseBody.textContent = JSON.stringify(data, null, 2);
          } catch (e) {
            const text = await res.text();
            callResponseBody.textContent = text || '(empty response)';
          }
        }

        callResponse.classList.add('visible');
      } catch (err) {
        callStatusBadge.className = 'status-badge error';
        callStatusBadge.textContent = 'Error';
        callResponseUrl.textContent = url;
        callResponseBody.textContent = err.message;
        callResponse.classList.add('visible');
      } finally {
        callBtn.disabled = false;
        callBtn.textContent = 'Call Endpoint';
      }
    });

    // Initialize wallet UI after page loads
    function initWallet() {
      if (typeof StacksConnect !== 'undefined') {
        updateWalletUI();
      } else {
        // Retry after a short delay if StacksConnect isn't ready
        setTimeout(initWallet, 100);
      }
    }

    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWallet);
    } else {
      initWallet();
    }
  </script>
</body>
</html>`;
}
