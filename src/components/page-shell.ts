/**
 * Shared page shell CSS for HTML pages
 * Contains base styles, typography, card components, and responsive breakpoints
 * used across dashboard, toolbox, and guide pages
 */

export function getPageShellCSS(): string {
  return `
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

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 1600px;
      margin: 0 auto;
      padding: 24px;
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    h1 .accent {
      color: var(--accent);
    }

    .subtitle {
      color: var(--text-muted);
      margin-bottom: 32px;
      font-size: 18px;
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

    /* Mobile optimizations */
    @media (max-width: 600px) {
      .container {
        padding: 16px;
      }

      .card {
        padding: 16px;
        border-radius: 12px;
      }

      .card h3 {
        font-size: 10px;
        margin-bottom: 6px;
      }

      .card .value {
        font-size: 20px;
        word-break: break-word;
      }
    }

    /* Extra small screens */
    @media (max-width: 380px) {
      .card .value {
        font-size: 24px;
      }
    }
  `;
}
