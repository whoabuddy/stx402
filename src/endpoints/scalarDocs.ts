import { Hono } from "hono";

/**
 * Generates themed Scalar API documentation HTML
 * Matches aibtc.com branding: black background, orange accents
 */
export function getScalarHTML(specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>STX402 API</title>
  <meta name="description" content="X402 micropayment-gated API endpoints on Stacks">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23f7931a' rx='12' width='100' height='100'/><text x='50' y='68' font-size='40' font-weight='800' text-anchor='middle' fill='%23000'>402</text></svg>">
  <link rel="preconnect" href="https://rsms.me/">
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
  <style>
    /* aibtc.com branding: black + Bitcoin orange theme */
    .dark-mode,
    .light-mode {
      --scalar-font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

      /* Bitcoin orange accent (#f7931a) */
      --scalar-color-accent: #f7931a;

      /* Dark backgrounds - matching dashboard */
      --scalar-background-1: #09090b;
      --scalar-background-2: #0f0f12;
      --scalar-background-3: #18181b;
      --scalar-background-4: #27272a;
      --scalar-background-accent: rgba(247, 147, 26, 0.12);

      /* Text colors - matching dashboard */
      --scalar-color-1: #fafafa;
      --scalar-color-2: #a1a1aa;
      --scalar-color-3: #71717a;

      /* Borders - subtle like dashboard */
      --scalar-border-color: rgba(255, 255, 255, 0.06);

      /* Buttons - Bitcoin orange */
      --scalar-button-1: #f7931a;
      --scalar-button-1-hover: #c2410c;
      --scalar-button-1-color: #000000;

      /* Links and interactive elements */
      --scalar-color-blue: #f7931a;
      --scalar-color-green: #3b82f6;  /* POST uses green var, override to brand blue */
      --scalar-color-red: #ef4444;
      --scalar-color-yellow: #f7931a;
      --scalar-color-orange: #f7931a;

      /* Code blocks - orange keywords */
      --scalar-color-code-keyword: #f7931a;
      --scalar-color-code-string: #22d3ee;
      --scalar-color-code-number: #a855f7;
      --scalar-color-code-comment: #52525b;
      --scalar-color-code-operator: #f7931a;
      --scalar-color-code-function: #fbbf24;

      /* Sidebar */
      --scalar-sidebar-background-1: #09090b;
      --scalar-sidebar-color-1: #fafafa;
      --scalar-sidebar-color-2: #a1a1aa;
      --scalar-sidebar-color-active: #f7931a;
      --scalar-sidebar-border-color: rgba(255, 255, 255, 0.06);

      /* Cards and panels */
      --scalar-card-background: #0f0f12;
    }

    /* Force dark mode only */
    .light-mode {
      color-scheme: dark;
    }

    /* Custom scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: #18181b;
    }
    ::-webkit-scrollbar-thumb {
      background: #3f3f46;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #52525b;
    }

    /* Header branding */
    .scalar-app .sidebar-header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    /* HTTP method badges - brand colors */
    [data-method="GET"],
    .scalar-api-client__send-request-button[data-method="GET"],
    .http-method--get,
    .scalar-app .http-method--get {
      background: rgba(247, 147, 26, 0.15) !important;
      color: #f7931a !important;
    }
    [data-method="POST"],
    .scalar-api-client__send-request-button[data-method="POST"],
    .http-method--post,
    .scalar-app .http-method--post {
      background: rgba(59, 130, 246, 0.15) !important;
      color: #3b82f6 !important;
    }

    /* Search highlight */
    .scalar-app mark {
      background: rgba(247, 147, 26, 0.3);
      color: #fafafa;
    }

    /* Active sidebar item */
    .scalar-app .sidebar-item-active {
      border-left-color: #f7931a !important;
    }

    /* Custom navigation bar */
    .stx402-nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      background: #09090b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 1000;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .stx402-nav-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #fafafa;
      font-weight: 600;
      font-size: 15px;
    }
    .stx402-nav-brand svg {
      width: 28px;
      height: 28px;
    }
    .stx402-nav-links {
      display: flex;
      gap: 8px;
    }
    .stx402-nav-link {
      color: #a1a1aa;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 6px;
      transition: all 0.15s ease;
    }
    .stx402-nav-link:hover {
      color: #fafafa;
      background: rgba(255, 255, 255, 0.06);
    }
    .stx402-nav-link.active {
      color: #f7931a;
      background: rgba(247, 147, 26, 0.12);
    }
    /* Push Scalar content below nav */
    .scalar-app {
      margin-top: 48px !important;
    }

    /* Mobile responsive styles */
    @media (max-width: 640px) {
      .stx402-nav {
        padding: 0 12px;
      }
      .stx402-nav-brand span {
        display: none;
      }
      .stx402-nav-links {
        gap: 4px;
      }
      .stx402-nav-link {
        font-size: 12px;
        padding: 6px 8px;
      }
    }
    @media (max-width: 400px) {
      .stx402-nav-link {
        font-size: 11px;
        padding: 5px 6px;
      }
    }
  </style>
</head>
<body>
  <nav class="stx402-nav">
    <a href="/" class="stx402-nav-brand">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect fill="#f7931a" rx="12" width="100" height="100"/>
        <text x="50" y="68" font-size="40" font-weight="800" text-anchor="middle" fill="#000">402</text>
      </svg>
      <span>STX402</span>
    </a>
    <div class="stx402-nav-links">
      <a href="/" class="stx402-nav-link active">API Docs</a>
      <a href="/dashboard" class="stx402-nav-link">Dashboard</a>
      <a href="/guide" class="stx402-nav-link">Guide</a>
      <a href="/about" class="stx402-nav-link">About</a>
    </div>
  </nav>
  <script id="api-reference" data-url="${specUrl}"></script>
  <script>
    var configuration = {
      theme: 'none',
      darkMode: true,
      hideDarkModeToggle: true,
      layout: 'modern',
      showSidebar: true,
      hideModels: false,
      defaultOpenAllTags: false,
      withDefaultFonts: false,
      metaData: {
        title: 'STX402 API',
        description: 'X402 micropayment-gated API endpoints on Stacks',
      },
      servers: [
        { url: 'https://stx402.com', description: 'Production' },
        { url: 'http://localhost:8787', description: 'Local Development' },
      ],
      defaultHttpClient: {
        targetKey: 'shell',
        clientKey: 'curl',
      },
      hiddenClients: {
        shell: ['httpie', 'wget'],
        node: ['ofetch'],
        php: ['curl'],
        python: ['httpx_async', 'httpx_sync'],
      },
    }
    document.getElementById('api-reference').dataset.configuration = JSON.stringify(configuration)
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}

/**
 * Register the Scalar docs route on a Hono app
 */
export function registerScalarDocs(app: Hono<{ Bindings: Env }>, path: string = "/", specUrl: string = "/openapi.json") {
  app.get(path, (c) => {
    return c.html(getScalarHTML(specUrl));
  });
}
