/**
 * Shared navigation bar component for all pages
 * STX402 Directory branding: dark background, orange accents
 */

export function getNavCSS(): string {
  return `
    /* Custom navigation bar */
    .stx402-nav {
      position: sticky;
      top: 0;
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

    /* Mobile responsive styles */
    @media (max-width: 640px) {
      .stx402-nav {
        padding: 0 12px;
      }
      .stx402-nav-brand span {
        display: none;
      }
      .stx402-nav-links {
        gap: 2px;
        flex-shrink: 0;
      }
      .stx402-nav-link {
        font-size: 12px;
        padding: 6px 8px;
        white-space: nowrap;
      }
    }
    @media (max-width: 400px) {
      .stx402-nav-link {
        font-size: 11px;
        padding: 5px 6px;
      }
    }
  `;
}

export type ActivePage = "docs" | "dashboard" | "guide" | "toolbox" | "about";

export function getNavHTML(activePage: ActivePage): string {
  const links = [
    { href: "/", label: "API Docs", page: "docs" as const },
    { href: "/dashboard", label: "Dashboard", page: "dashboard" as const },
    { href: "/guide", label: "Guide", page: "guide" as const },
    { href: "/toolbox", label: "Toolbox", page: "toolbox" as const },
    { href: "/about", label: "About", page: "about" as const },
  ];

  return `
  <nav class="stx402-nav">
    <a href="/" class="stx402-nav-brand">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(247, 147, 26, 0.3));">
        <defs>
          <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f7931a"/>
            <stop offset="100%" stop-color="#c2410c"/>
          </linearGradient>
        </defs>
        <rect fill="url(#logo-gradient)" rx="8" width="100" height="100"/>
        <text x="50" y="68" font-size="40" font-weight="800" text-anchor="middle" fill="#000">402</text>
      </svg>
      <span>STX402</span>
    </a>
    <div class="stx402-nav-links">
      ${links.map(link =>
        `<a href="${link.href}" class="stx402-nav-link${link.page === activePage ? " active" : ""}">${link.label}</a>`
      ).join("\n      ")}
    </div>
  </nav>`;
}
