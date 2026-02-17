import type { AppContext } from "../types";
import { getNavCSS, getNavHTML } from "../components/nav";
import { getPageShellCSS } from "../components/page-shell";
import { BaseEndpoint } from "./BaseEndpoint";

export class ToolboxPage extends BaseEndpoint {
  schema = {
    tags: ["Info"],
    summary: "402 Checker - test any URL for X402 payment requirements (free)",
    responses: {
      "200": {
        description: "HTML page",
        content: { "text/html": { schema: { type: "string" } } },
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
  <title>402 Checker - STX402</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://rsms.me/">
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
  <style>
    ${getNavCSS()}
    ${getPageShellCSS()}

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
      flex-wrap: wrap;
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

    .status-badge.success {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    .status-badge.error {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .status-badge.info {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
    }

    .checked-url {
      font-size: 13px;
      color: #71717a;
      font-family: 'SF Mono', Monaco, monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .result-section {
      background: #18181b;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }

    .result-section h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fafafa;
    }

    .result-section p {
      color: #a1a1aa;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 8px;
    }

    .result-section p:last-child {
      margin-bottom: 0;
    }

    .price-highlight {
      color: #f7931a;
      font-weight: 600;
    }

    .tokens-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }

    .token-card {
      background: #27272a;
      padding: 12px;
      border-radius: 6px;
      text-align: center;
    }

    .token-card .token-name {
      font-size: 11px;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .token-card .token-amount {
      font-size: 16px;
      font-weight: 600;
      font-family: 'SF Mono', Monaco, monospace;
    }

    .token-card.stx .token-amount { color: #06b6d4; }
    .token-card.sbtc .token-amount { color: #f7931a; }
    .token-card.usdcx .token-amount { color: #3b82f6; }

    .code-block {
      background: #0f0f12;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      font-size: 12px;
      font-family: 'SF Mono', Monaco, monospace;
      line-height: 1.6;
      color: #a1a1aa;
      margin-top: 12px;
    }

    .code-block .comment { color: #6b7280; }
    .code-block .keyword { color: #c084fc; }
    .code-block .string { color: #4ade80; }
    .code-block .property { color: #60a5fa; }

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

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      color: #71717a;
      font-size: 13px;
    }

    .info-value {
      color: #fafafa;
      font-size: 13px;
      font-family: 'SF Mono', Monaco, monospace;
    }

    .info-value a {
      color: #f7931a;
      text-decoration: none;
    }

    .info-value a:hover {
      text-decoration: underline;
    }

    /* Loading state */
    .loading {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #a1a1aa;
      font-size: 14px;
      padding: 20px;
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

    /* Footer */
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

    .help-text {
      background: #18181b;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
      font-size: 13px;
      color: #a1a1aa;
    }

    .help-text code {
      background: #27272a;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      color: #22d3ee;
    }
  </style>
</head>
<body>
  ${getNavHTML("toolbox")}

  <div class="container">
    <h1><span class="accent">402</span> Checker</h1>
    <p class="subtitle">Test any URL to see if it requires X402 payment</p>

    <div class="tool-card">
      <h2>Check an Endpoint</h2>
      <p>Enter a URL to probe for X402 payment requirements. Works with any X402-compatible API.</p>

      <div class="input-group">
        <input type="url" id="url-input" placeholder="https://stx402.com/registry/probe" autocomplete="off">
        <select id="quick-select">
          <option value="">Try an example...</option>
          <optgroup label="STX402 - Paid">
            <option value="https://stx402.com/registry/probe">registry/probe (0.003 STX)</option>
            <option value="https://stx402.com/links/create">links/create (0.001 STX)</option>
            <option value="https://stx402.com/agent/info">agent/info (0.001 STX)</option>
          </optgroup>
          <optgroup label="STX402 - Free">
            <option value="https://stx402.com/registry/list">registry/list</option>
            <option value="https://stx402.com/agent/registry">agent/registry</option>
          </optgroup>
          <optgroup label="X402 AIBTC">
            <option value="https://x402.aibtc.com/hashing/sha256">hashing/sha256</option>
            <option value="https://x402.aibtc.com/stacks/decode/clarity">stacks/decode/clarity</option>
          </optgroup>
        </select>
        <button id="check-btn">Check</button>
      </div>

      <div class="results" id="results">
        <!-- Populated by JavaScript -->
      </div>

      <div class="help-text">
        <strong>Tip:</strong> Press <code>/</code> to focus the URL input, <code>Enter</code> to check, <code>Esc</code> to clear.
      </div>

      <div class="tool-footer">
        Learn more about <a href="https://x402.org" target="_blank">X402 payments</a> or browse the <a href="/guide">endpoint guide</a>.
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
        urlInput.value = this.value;
        this.value = '';
        checkBtn.click();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.key === '/' && document.activeElement !== urlInput) {
        e.preventDefault();
        urlInput.focus();
      }
      if (e.key === 'Escape' && document.activeElement === urlInput) {
        urlInput.value = '';
        results.classList.remove('visible');
        urlInput.blur();
      }
    });

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
      results.innerHTML = '<div class="loading"><div class="spinner"></div>Checking endpoint...</div>';
      checkBtn.disabled = true;

      try {
        const urlObj = new URL(url);
        const isSameOrigin = urlObj.origin === window.location.origin;

        if (isSameOrigin) {
          const res = await fetch(url, { method: 'GET' });
          await displayResult(url, res);
        } else {
          try {
            const res = await fetch(url, { method: 'GET', mode: 'cors' });
            await displayResult(url, res);
          } catch (corsError) {
            displayCorsBlocked(url);
          }
        }
      } catch (err) {
        displayError(url, err.message);
      } finally {
        checkBtn.disabled = false;
      }
    });

    async function displayResult(url, res) {
      const status = res.status;
      const x402Header = res.headers.get('X-402');

      let html = '<div class="results-header">';

      if (status === 402) {
        // Payment required - the interesting case!
        html += '<span class="status-badge payment-required">402 Payment Required</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';

        // Try to get payment details from response body or header
        let paymentInfo = null;
        try {
          if (x402Header) {
            paymentInfo = JSON.parse(x402Header);
          } else {
            paymentInfo = await res.json();
          }
        } catch (e) {
          // Couldn't parse payment info
        }

        if (paymentInfo) {
          html += renderPaymentDetails(url, paymentInfo);
        } else {
          html += '<div class="result-section">';
          html += '<h3>Payment Required</h3>';
          html += '<p>This endpoint requires payment but we couldn\\'t parse the requirements.</p>';
          html += '<p>Check the response headers for X-402 or the response body for payment details.</p>';
          html += '</div>';
        }

      } else if (status >= 200 && status < 300) {
        // Success - free endpoint
        html += '<span class="status-badge success">' + status + ' OK</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';

        html += '<div class="result-section">';
        html += '<h3>Free Endpoint</h3>';
        html += '<p>This endpoint returned <strong>' + status + '</strong> without requiring payment.</p>';
        html += '<p>You can call it directly without the X402 payment flow.</p>';
        html += '</div>';

        // Show response preview
        try {
          const data = await res.clone().json();
          html += '<div class="result-section">';
          html += '<h3>Response Preview</h3>';
          html += '<div class="code-block"><pre>' + escapeHtml(JSON.stringify(data, null, 2).slice(0, 500));
          if (JSON.stringify(data).length > 500) html += '\\n...';
          html += '</pre></div>';
          html += '</div>';
        } catch (e) {
          // Not JSON, skip preview
        }

      } else if (status >= 300 && status < 400) {
        // Redirect
        html += '<span class="status-badge info">' + status + ' Redirect</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';

        html += '<div class="result-section">';
        html += '<h3>Redirect Response</h3>';
        const location = res.headers.get('Location');
        if (location) {
          html += '<p>This URL redirects to: <code>' + escapeHtml(location) + '</code></p>';
        } else {
          html += '<p>This URL returns a ' + status + ' redirect response.</p>';
        }
        html += '</div>';

      } else if (status === 401) {
        // Unauthorized
        html += '<span class="status-badge error">401 Unauthorized</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';

        html += '<div class="result-section">';
        html += '<h3>Authentication Required</h3>';
        html += '<p>This endpoint requires authentication (API key, bearer token, etc.).</p>';
        html += '<p>This is different from X402 payment - you need credentials to access this API.</p>';
        html += '</div>';

      } else if (status === 403) {
        // Forbidden
        html += '<span class="status-badge error">403 Forbidden</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';

        html += '<div class="result-section">';
        html += '<h3>Access Forbidden</h3>';
        html += '<p>This endpoint denied access. You may not have permission to call it.</p>';
        html += '</div>';

      } else if (status === 404) {
        // Not found
        html += '<span class="status-badge error">404 Not Found</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';

        html += '<div class="result-section">';
        html += '<h3>Endpoint Not Found</h3>';
        html += '<p>This URL doesn\\'t exist or the endpoint has been removed.</p>';
        html += '<p>Double-check the URL or try the <a href="/guide">endpoint guide</a> for valid paths.</p>';
        html += '</div>';

      } else {
        // Other error
        html += '<span class="status-badge error">' + status + ' Error</span>';
        html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
        html += '</div>';

        html += '<div class="result-section">';
        html += '<h3>Error Response</h3>';
        html += '<p>The server returned HTTP ' + status + '.</p>';
        try {
          const data = await res.clone().json();
          if (data.error || data.message) {
            html += '<p><strong>Message:</strong> ' + escapeHtml(data.error || data.message) + '</p>';
          }
        } catch (e) {}
        html += '</div>';
      }

      results.innerHTML = html;
      setupCopyButtons();
    }

    function renderPaymentDetails(url, info) {
      let html = '';

      // Parse payment info - handle both X-402 header format and response body format
      let amount = null;
      let payTo = null;
      let network = null;
      let facilitator = null;
      let tokens = [];

      if (info.accepts && Array.isArray(info.accepts)) {
        // X-402 header format: { accepts: [{scheme, network, maxAmount, payTo, ...}] }
        const first = info.accepts[0];
        amount = first.maxAmountRequired || first.maxAmount;
        payTo = first.payTo;
        network = first.network;

        // Extract all tokens
        info.accepts.forEach(a => {
          let tokenName = 'STX';
          let tokenAmount = a.maxAmountRequired || a.maxAmount;
          if (a.asset) {
            if (a.asset.includes('sbtc')) tokenName = 'sBTC';
            else if (a.asset.includes('usdc')) tokenName = 'USDCx';
          }
          tokens.push({ name: tokenName, amount: tokenAmount });
        });
      } else {
        // Response body format: { maxAmountRequired, payTo, network, ... }
        amount = info.maxAmountRequired || info.maxAmount;
        payTo = info.payTo;
        network = info.network;
        facilitator = info.facilitator;

        const tokenName = info.tokenType || 'STX';
        tokens.push({ name: tokenName, amount: amount });
      }

      // Payment summary section
      html += '<div class="result-section">';
      html += '<h3>Payment Required</h3>';

      if (tokens.length > 0) {
        html += '<p>This endpoint accepts payment in the following tokens:</p>';
        html += '<div class="tokens-grid">';
        tokens.forEach(t => {
          const amountNum = t.amount ? (parseInt(t.amount) / 1000000).toFixed(6) : '?';
          const tokenClass = t.name.toLowerCase().replace('x', '');
          html += '<div class="token-card ' + tokenClass + '">';
          html += '<div class="token-name">' + t.name + '</div>';
          html += '<div class="token-amount">' + amountNum + '</div>';
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';

      // Technical details
      html += '<div class="result-section">';
      html += '<h3>Payment Details</h3>';
      html += '<div class="info-row"><span class="info-label">Pay To</span><span class="info-value">' + (payTo ? escapeHtml(payTo.slice(0,12) + '...' + payTo.slice(-8)) : 'Unknown') + '</span></div>';
      html += '<div class="info-row"><span class="info-label">Network</span><span class="info-value">' + (network || 'mainnet') + '</span></div>';
      html += '<div class="info-row"><span class="info-label">Facilitator</span><span class="info-value"><a href="https://facilitator.x402stacks.xyz" target="_blank">facilitator.x402stacks.xyz</a></span></div>';
      html += '</div>';

      // Code example
      const urlObj = new URL(url);
      const endpoint = urlObj.pathname;
      const host = urlObj.origin;

      html += '<div class="result-section">';
      html += '<h3>Code Example</h3>';
      html += '<p>Use the <a href="https://www.npmjs.com/package/x402-stacks" target="_blank" style="color:#f7931a;">x402-stacks</a> client to call this endpoint:</p>';
      html += '<div class="code-block" id="code-example">';
      html += '<span class="keyword">import</span> { X402PaymentClient } <span class="keyword">from</span> <span class="string">"x402-stacks"</span>;\\n\\n';
      html += '<span class="keyword">const</span> client = <span class="keyword">new</span> X402PaymentClient({\\n';
      html += '  <span class="property">network</span>: <span class="string">"' + (network || 'mainnet') + '"</span>,\\n';
      html += '  <span class="property">privateKey</span>: process.env.STACKS_PRIVATE_KEY,\\n';
      html += '});\\n\\n';
      html += '<span class="keyword">const</span> result = <span class="keyword">await</span> client.call(<span class="string">"' + escapeHtml(url) + '"</span>, {\\n';
      html += '  <span class="property">method</span>: <span class="string">"POST"</span>,\\n';
      html += '  <span class="property">body</span>: { <span class="comment">/* your request data */</span> },\\n';
      html += '});\\n\\n';
      html += '<span class="keyword">console</span>.log(result);';
      html += '</div>';
      html += '<button class="copy-btn" data-copy="code-example">Copy Code</button>';
      html += '</div>';

      return html;
    }

    function displayCorsBlocked(url) {
      let html = '<div class="results-header">';
      html += '<span class="status-badge info">CORS Blocked</span>';
      html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
      html += '</div>';

      html += '<div class="result-section">';
      html += '<h3>Cross-Origin Request Blocked</h3>';
      html += '<p>Your browser blocked this request due to CORS (Cross-Origin Resource Sharing) security policy.</p>';
      html += '<p>The endpoint exists but doesn\\'t allow browser requests from other origins.</p>';
      html += '</div>';

      html += '<div class="result-section">';
      html += '<h3>Try from Terminal</h3>';
      html += '<p>You can check this URL using curl:</p>';
      html += '<div class="code-block" id="curl-cmd">curl -I ' + escapeHtml(url) + '</div>';
      html += '<button class="copy-btn" data-copy="curl-cmd">Copy Command</button>';
      html += '</div>';

      results.innerHTML = html;
      setupCopyButtons();
    }

    function displayError(url, message) {
      let html = '<div class="results-header">';
      html += '<span class="status-badge error">Error</span>';
      html += '<span class="checked-url">' + escapeHtml(url) + '</span>';
      html += '</div>';

      html += '<div class="result-section">';
      html += '<h3>Request Failed</h3>';
      html += '<p>' + escapeHtml(message) + '</p>';
      html += '<p>This could be a network error, invalid URL, or the server is unreachable.</p>';
      html += '</div>';

      results.innerHTML = html;
    }

    function setupCopyButtons() {
      document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
        btn.addEventListener('click', async function() {
          const targetId = this.dataset.copy;
          const target = document.getElementById(targetId);
          if (target) {
            // Get text content, stripping HTML tags
            const text = target.textContent || target.innerText;
            await navigator.clipboard.writeText(text);
            this.textContent = 'Copied!';
            this.classList.add('copied');
            setTimeout(() => {
              this.textContent = this.dataset.copy === 'code-example' ? 'Copy Code' : 'Copy Command';
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
</body>
</html>`;
}
