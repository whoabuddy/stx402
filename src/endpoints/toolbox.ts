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

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 48px;
    }

    .page-header .title-section h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .page-header .title-section .subtitle {
      color: #a1a1aa;
      font-size: 16px;
    }

    .tool-card {
      background: #0f0f12;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 32px;
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

    /* Wallet connection */
    .wallet-section {
      flex-shrink: 0;
    }

    .connect-btn {
      padding: 10px 20px;
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

    .connect-btn:hover {
      opacity: 0.9;
    }

    .connect-btn:active {
      transform: scale(0.98);
    }

    .connect-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .wallet-connected {
      position: relative;
    }

    .wallet-address-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #fafafa;
      font-size: 13px;
      font-family: 'SF Mono', Monaco, monospace;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .wallet-address-btn:hover {
      border-color: #f7931a;
    }

    .wallet-address-btn::after {
      content: "▼";
      font-size: 10px;
      color: #71717a;
      transition: transform 0.15s ease;
    }

    .wallet-address-btn.open::after {
      transform: rotate(180deg);
    }

    .wallet-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 160px;
      background: #18181b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      overflow: hidden;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-8px);
      transition: all 0.15s ease;
      z-index: 100;
    }

    .wallet-dropdown.open {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }

    .wallet-dropdown button {
      display: block;
      width: 100%;
      padding: 12px 16px;
      background: none;
      border: none;
      color: #a1a1aa;
      font-size: 13px;
      font-family: inherit;
      text-align: left;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .wallet-dropdown button:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #fafafa;
    }

    .wallet-dropdown button.disconnect {
      color: #ef4444;
    }

    .wallet-dropdown button.disconnect:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    @media (max-width: 500px) {
      .page-header {
        flex-direction: column;
        gap: 16px;
        text-align: center;
      }
      .wallet-section {
        align-self: center;
      }
    }
  </style>
</head>
<body>
  ${getNavHTML("toolbox")}

  <div class="container">
    <div class="page-header">
      <div class="title-section">
        <h1>Toolbox</h1>
        <p class="subtitle">Interactive tools for the curious</p>
      </div>
      <div class="wallet-section" id="wallet-section">
        <button class="connect-btn" id="connect-btn">Connect Wallet</button>
      </div>
    </div>

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
    // Wallet connection logic using @stacks/connect v8
    const walletSection = document.getElementById('wallet-section');
    const connectBtn = document.getElementById('connect-btn');

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
        const stxAddress = data?.addresses?.stx?.[0]?.address;

        if (stxAddress) {
          walletSection.innerHTML = \`
            <div class="wallet-connected">
              <button class="wallet-address-btn" id="wallet-address-btn">
                \${truncateAddress(stxAddress)}
              </button>
              <div class="wallet-dropdown" id="wallet-dropdown">
                <button id="copy-address-btn" data-address="\${stxAddress}">Copy Address</button>
                <button class="disconnect" id="disconnect-btn">Disconnect</button>
              </div>
            </div>
          \`;

          // Setup dropdown toggle
          const addressBtn = document.getElementById('wallet-address-btn');
          const dropdown = document.getElementById('wallet-dropdown');

          addressBtn.addEventListener('click', () => {
            addressBtn.classList.toggle('open');
            dropdown.classList.toggle('open');
          });

          // Close dropdown when clicking outside
          document.addEventListener('click', (e) => {
            if (!e.target.closest('.wallet-connected')) {
              addressBtn.classList.remove('open');
              dropdown.classList.remove('open');
            }
          });

          // Copy address
          document.getElementById('copy-address-btn').addEventListener('click', async (e) => {
            const address = e.target.dataset.address;
            await navigator.clipboard.writeText(address);
            e.target.textContent = 'Copied!';
            setTimeout(() => {
              e.target.textContent = 'Copy Address';
            }, 2000);
          });

          // Disconnect
          document.getElementById('disconnect-btn').addEventListener('click', () => {
            handleDisconnect();
          });

          return;
        }
      }

      // Not connected - show connect button
      walletSection.innerHTML = '<button class="connect-btn" id="connect-btn">Connect Wallet</button>';
      document.getElementById('connect-btn').addEventListener('click', handleConnect);
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

    // Initialize on page load
    connectBtn.addEventListener('click', handleConnect);

    // Check if already connected
    if (typeof StacksConnect !== 'undefined') {
      updateWalletUI();
    }
  </script>
</body>
</html>`;
}
