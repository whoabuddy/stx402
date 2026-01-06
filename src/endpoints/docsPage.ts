import type { Context } from "hono";

export function getThemedDocsUI(schemaUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="description" content="STX402 API - Payment-gated endpoints on Stacks"/>
  <title>STX402 API Documentation</title>
  <link rel="preconnect" href="https://rsms.me/">
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" integrity="sha256-QBcPDuhZ0X+SExunBzKaiKBw5PZodNETZemnfSMvYRc=" crossorigin="anonymous">
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
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }

    /* Custom header */
    .custom-header {
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
      transform: translateY(-1px);
    }

    /* Swagger UI Dark Theme Overrides */
    .swagger-ui {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    }
    .swagger-ui .topbar { display: none !important; }
    .swagger-ui .info { margin: 32px 0 !important; }
    .swagger-ui .info .title { color: var(--text-primary) !important; font-weight: 600 !important; }
    .swagger-ui .info .description { color: var(--text-secondary) !important; }
    .swagger-ui .info a { color: var(--accent) !important; }
    .swagger-ui .scheme-container {
      background: var(--bg-card) !important;
      box-shadow: none !important;
      border: 1px solid var(--border) !important;
      border-radius: 12px !important;
      padding: 16px !important;
    }
    .swagger-ui .opblock-tag {
      color: var(--text-primary) !important;
      border-bottom: 1px solid var(--border) !important;
    }
    .swagger-ui .opblock-tag:hover { background: var(--bg-hover) !important; }
    .swagger-ui .opblock {
      background: var(--bg-card) !important;
      border: 1px solid var(--border) !important;
      border-radius: 12px !important;
      margin-bottom: 12px !important;
      box-shadow: none !important;
    }
    .swagger-ui .opblock .opblock-summary {
      border: none !important;
      padding: 12px 16px !important;
    }
    .swagger-ui .opblock .opblock-summary-method {
      border-radius: 6px !important;
      font-weight: 600 !important;
      min-width: 70px !important;
    }
    .swagger-ui .opblock .opblock-summary-path { color: var(--text-primary) !important; }
    .swagger-ui .opblock .opblock-summary-description { color: var(--text-muted) !important; }
    .swagger-ui .opblock.opblock-get { border-color: #22d3ee30 !important; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #0891b2 !important; }
    .swagger-ui .opblock.opblock-post { border-color: #4ade8030 !important; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #16a34a !important; }
    .swagger-ui .opblock.opblock-put { border-color: #f7931a30 !important; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #f7931a !important; }
    .swagger-ui .opblock.opblock-delete { border-color: #f8717130 !important; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #dc2626 !important; }
    .swagger-ui .opblock-body { background: var(--bg-primary) !important; }
    .swagger-ui .opblock-body pre {
      background: var(--bg-card) !important;
      border: 1px solid var(--border) !important;
      border-radius: 8px !important;
      color: var(--text-primary) !important;
    }
    .swagger-ui .opblock-section-header {
      background: var(--bg-hover) !important;
      border: none !important;
    }
    .swagger-ui .opblock-section-header h4 { color: var(--text-primary) !important; }
    .swagger-ui .parameters-col_description { color: var(--text-secondary) !important; }
    .swagger-ui .parameter__name { color: var(--text-primary) !important; }
    .swagger-ui .parameter__type { color: var(--text-muted) !important; }
    .swagger-ui .parameter__in { color: var(--text-muted) !important; }
    .swagger-ui table thead tr td, .swagger-ui table thead tr th {
      color: var(--text-muted) !important;
      border-bottom: 1px solid var(--border) !important;
    }
    .swagger-ui .response-col_status { color: var(--text-primary) !important; }
    .swagger-ui .response-col_description { color: var(--text-secondary) !important; }
    .swagger-ui .responses-inner { background: transparent !important; }
    .swagger-ui .model-box { background: var(--bg-card) !important; }
    .swagger-ui .model { color: var(--text-primary) !important; }
    .swagger-ui .model-title { color: var(--text-primary) !important; }
    .swagger-ui section.models {
      background: var(--bg-card) !important;
      border: 1px solid var(--border) !important;
      border-radius: 12px !important;
    }
    .swagger-ui section.models h4 { color: var(--text-primary) !important; }
    .swagger-ui .model-container { background: var(--bg-hover) !important; }
    .swagger-ui .prop-type { color: #06b6d4 !important; }
    .swagger-ui .prop-format { color: var(--text-muted) !important; }
    .swagger-ui input[type=text], .swagger-ui textarea {
      background: var(--bg-card) !important;
      border: 1px solid var(--border) !important;
      color: var(--text-primary) !important;
      border-radius: 6px !important;
    }
    .swagger-ui input[type=text]:focus, .swagger-ui textarea:focus {
      border-color: var(--accent) !important;
      outline: none !important;
    }
    .swagger-ui select {
      background: var(--bg-card) !important;
      border: 1px solid var(--border) !important;
      color: var(--text-primary) !important;
      border-radius: 6px !important;
    }
    .swagger-ui .btn {
      border-radius: 6px !important;
      font-weight: 500 !important;
    }
    .swagger-ui .btn.execute {
      background: var(--accent) !important;
      border-color: var(--accent) !important;
      color: #000 !important;
    }
    .swagger-ui .btn.execute:hover {
      background: #c2410c !important;
      border-color: #c2410c !important;
    }
    .swagger-ui .btn.cancel { background: var(--bg-hover) !important; }
    .swagger-ui .loading-container .loading::after { border-top-color: var(--accent) !important; }
    .swagger-ui .responses-table { background: transparent !important; }
    .swagger-ui .response { background: transparent !important; }
    .swagger-ui .markdown p, .swagger-ui .markdown li { color: var(--text-secondary) !important; }
    .swagger-ui .markdown code {
      background: var(--bg-card) !important;
      color: var(--accent) !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
    }
    .swagger-ui .wrapper { padding: 0 32px !important; max-width: 1400px !important; }
    .swagger-ui .information-container { padding: 0 !important; }

    /* Mobile */
    @media (max-width: 600px) {
      .custom-header {
        padding: 12px 16px;
        gap: 8px;
      }
      .logo {
        width: 32px;
        height: 32px;
        font-size: 12px;
      }
      .header-title {
        font-size: 16px;
      }
      .header-nav a {
        padding: 6px 12px;
        font-size: 12px;
      }
      .swagger-ui .wrapper {
        padding: 0 16px !important;
      }
    }
  </style>
</head>
<body>
  <div class="custom-header">
    <div class="logo">402</div>
    <div class="header-title"><span class="accent">STX402</span> API</div>
    <nav class="header-nav">
      <a href="/dashboard">Dashboard</a>
      <a href="https://x402.org" target="_blank">X402</a>
    </nav>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" integrity="sha256-wuSp7wgUSDn/R8FCAgY+z+TlnnCk5xVKJr1Q2IDIi6E=" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js" integrity="sha256-M7em9a/KxJAv35MoG+LS4S2xXyQdOEYG5ubRd0W3+G8=" crossorigin="anonymous"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${schemaUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        defaultModelsExpandDepth: -1,
        docExpansion: 'list',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha'
      });
    };
  </script>
</body>
</html>`;
}

export function docsHandler(c: Context) {
  const html = getThemedDocsUI("/openapi.json");
  return c.html(html);
}
