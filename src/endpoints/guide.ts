import type { AppContext } from "../types";
import { getNavCSS, getNavHTML } from "../components/nav";
import { BaseEndpoint } from "./BaseEndpoint";

export class GuidePage extends BaseEndpoint {
  schema = {
    tags: ["System"],
    summary: "Endpoint category guide (free)",
    responses: {
      "200": {
        description: "HTML guide page",
        content: {
          "text/html": {
            schema: { type: "string" as const },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const html = generateGuideHTML();
    return c.html(html);
  }
}

interface Category {
  name: string;
  color: string;
  icon: string;
  description: string;
  useFor: string;
  examples: { path: string; name: string }[];
  tier: string;
  tierPrice: string;
}

const categories: Category[] = [
  {
    name: "Registry",
    color: "#f59e0b",
    icon: "&#128218;",
    description: "X402 endpoint discovery and registration - make your API discoverable by developers and AI agents across the ecosystem",
    useFor: "Registering your X402 endpoints to join the directory, probing payment requirements, listing available endpoints, managing ownership, transferring endpoints",
    examples: [
      { path: "/registry/list", name: "list (free)" },
      { path: "/registry/register", name: "register" },
      { path: "/registry/probe", name: "probe" },
      { path: "/registry/my-endpoints", name: "my-endpoints" },
    ],
    tier: "ai / free",
    tierPrice: "0.003 STX or free",
  },
  {
    name: "Links",
    color: "#f472b6",
    icon: "&#128279;",
    description: "URL shortener with click tracking",
    useFor: "Creating short links, expanding slugs to original URLs, viewing click statistics, managing your links",
    examples: [
      { path: "/links/create", name: "create" },
      { path: "/links/expand/:slug", name: "expand (free)" },
      { path: "/links/stats", name: "stats" },
      { path: "/links/list", name: "list" },
    ],
    tier: "storage_read/write",
    tierPrice: "0.0005-0.001 STX",
  },
  {
    name: "Agent Identity",
    color: "#34d399",
    icon: "&#129302;",
    description: "ERC-8004 agent identity registry on Stacks",
    useFor: "Querying agent metadata, looking up agents by owner, checking agent URIs and versions",
    examples: [
      { path: "/agent/registry", name: "registry (free)" },
      { path: "/agent/info", name: "info" },
      { path: "/agent/lookup", name: "lookup" },
      { path: "/agent/metadata", name: "metadata" },
    ],
    tier: "simple / free",
    tierPrice: "0.001 STX or free",
  },
  {
    name: "Agent Reputation",
    color: "#8b5cf6",
    icon: "&#11088;",
    description: "ERC-8004 agent reputation tracking",
    useFor: "Viewing reputation summaries, listing feedback, checking client interactions, generating auth hashes for feedback submission",
    examples: [
      { path: "/agent/reputation/summary", name: "summary" },
      { path: "/agent/reputation/list", name: "list" },
      { path: "/agent/reputation/clients", name: "clients" },
      { path: "/agent/reputation/auth-hash", name: "auth-hash" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
  {
    name: "Agent Validation",
    color: "#06b6d4",
    icon: "&#9989;",
    description: "ERC-8004 agent validation tracking",
    useFor: "Checking validation request status, viewing validation summaries, listing validations for an agent",
    examples: [
      { path: "/agent/validation/status", name: "status" },
      { path: "/agent/validation/summary", name: "summary" },
      { path: "/agent/validation/list", name: "list" },
      { path: "/agent/validation/requests", name: "requests" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
];

function generateGuideHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Endpoint Guide - STX402</title>
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
    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .category-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 20px;
      transition: border-color 0.15s, transform 0.15s;
    }
    .category-card:hover {
      border-color: #3f3f46;
      transform: translateY(-2px);
    }
    .category-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .category-icon {
      font-size: 28px;
    }
    .category-name {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }
    .category-description {
      color: #a1a1aa;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .use-for {
      font-size: 13px;
      color: #71717a;
      margin-bottom: 16px;
      padding: 12px;
      background: #0a0a0f;
      border-radius: 8px;
    }
    .use-for strong { color: #a1a1aa; }
    .examples {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .example {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 11px;
      background: #27272a;
      padding: 4px 8px;
      border-radius: 4px;
      color: #22d3ee;
      text-decoration: none;
      transition: background 0.15s;
    }
    .example:hover {
      background: #3f3f46;
    }
    .tier-badge {
      display: inline-block;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
    }
    .tier-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #71717a;
    }
    .price { color: #22d3ee; font-weight: 500; }
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
    .quick-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 32px;
    }
    .quick-nav a {
      background: #27272a;
      color: #a1a1aa;
      padding: 6px 12px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 13px;
      transition: background 0.15s, color 0.15s;
    }
    .quick-nav a:hover {
      background: #3f3f46;
      color: #fff;
    }
    .intro {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 32px;
    }
    .intro p { color: #a1a1aa; margin: 0; }
    .intro strong { color: #fff; }
    .search-container {
      margin-bottom: 24px;
    }
    .search-input {
      width: 100%;
      padding: 12px 16px;
      font-size: 16px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      color: #e4e4e7;
      outline: none;
      transition: border-color 0.15s;
    }
    .search-input:focus {
      border-color: #f7931a;
    }
    .search-input::placeholder {
      color: #52525b;
    }
    .search-results {
      font-size: 13px;
      color: #71717a;
      margin-top: 8px;
    }
    .category-card.hidden {
      display: none;
    }
    .no-results {
      text-align: center;
      padding: 48px;
      color: #71717a;
      display: none;
    }
    .no-results.visible {
      display: block;
    }
  </style>
</head>
<body>
  ${getNavHTML("guide")}
  <div class="container">
    <h1><span class="accent">STX402</span> Directory Guide</h1>
    <p class="subtitle">The X402 Directory - endpoint discovery and agent identity</p>

    <div class="intro">
      <p>
        <strong>STX402 Directory</strong> is the meta layer for the X402 ecosystem.
        Discover and register X402 endpoints, and interact with ERC-8004 agent registries on Stacks.
        All endpoints return JSON and accept <strong>STX</strong>, <strong>sBTC</strong>, or <strong>USDCx</strong> for payment.
      </p>
      <p style="margin-top: 12px; color: #71717a;">
        <strong style="color: #f59e0b;">Why register?</strong> Registered endpoints are discoverable by developers and AI agents building on X402.
        Get your API in front of the ecosystem, enable automated discovery, and join a growing network of monetized services.
      </p>
    </div>

    <div class="intro" style="border-color: #f59e0b;">
      <p>
        <strong style="color: #f59e0b;">&#128279; Looking for utilities?</strong> General-purpose
        endpoints (hashing, storage, AI, Stacks utilities) have moved to
        <a href="https://x402.aibtc.com" target="_blank" style="color: #f7931a;">x402.aibtc.com</a>.
        STX402 now focuses on directory and identity services.
        See <a href="#ecosystem" style="color: #f7931a;">ecosystem links</a> below.
      </p>
    </div>

    <div class="search-container">
      <input type="text" class="search-input" id="search" placeholder="Search categories or endpoints (e.g., sha256, json, stacks)" autocomplete="off" />
      <div class="search-results" id="search-results"></div>
    </div>

    <div class="quick-nav" id="quick-nav">
      ${categories.map(c => `<a href="#${c.name.toLowerCase()}">${c.name}</a>`).join("")}
    </div>

    <div class="categories-grid" id="categories-grid">
      ${categories.map(c => `
        <div class="category-card" id="${c.name.toLowerCase()}" data-category="${c.name.toLowerCase()}" data-endpoints="${c.examples.map(e => e.name.toLowerCase()).join(" ")}" data-description="${c.description.toLowerCase()} ${c.useFor.toLowerCase()}">
          <div class="category-header">
            <span class="category-icon">${c.icon}</span>
            <span class="category-name" style="color: ${c.color}">${c.name}</span>
          </div>
          <p class="category-description">${c.description}</p>
          <div class="use-for">
            <strong>Use for:</strong> ${c.useFor}
          </div>
          <div class="examples">
            ${c.examples.map(e => `<span class="example">${e.path}</span>`).join("")}
          </div>
          <div class="tier-info">
            <span class="tier-badge" style="background: ${c.color}22; color: ${c.color}; border: 1px solid ${c.color}44;">${c.tier}</span>
            <span class="price">${c.tierPrice}</span>
          </div>
        </div>
      `).join("")}
    </div>

    <div class="no-results" id="no-results">
      No categories or endpoints match your search.
    </div>

    <div id="ecosystem" style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #27272a;">
      <h2 style="font-size: 22px; font-weight: 600; color: #fff; margin-bottom: 16px;">
        <span style="color: #f7931a;">&#127760;</span> Ecosystem Links
      </h2>
      <p style="color: #a1a1aa; margin-bottom: 20px;">
        Learn more about X402 and the Stacks ecosystem.
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
        <a href="https://x402.org" target="_blank" style="display: block; background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; text-decoration: none; transition: border-color 0.15s;">
          <div style="font-size: 18px; margin-bottom: 4px;">&#128220;</div>
          <div style="color: #fff; font-weight: 500; margin-bottom: 4px;">X402 Protocol</div>
          <div style="color: #71717a; font-size: 13px;">Official specification for HTTP 402 micropayments</div>
        </a>
        <a href="https://x402.aibtc.com" target="_blank" style="display: block; background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; text-decoration: none; transition: border-color 0.15s;">
          <div style="font-size: 18px; margin-bottom: 4px;">&#9889;</div>
          <div style="color: #fff; font-weight: 500; margin-bottom: 4px;">X402 AIBTC API</div>
          <div style="color: #71717a; font-size: 13px;">General-purpose utilities: hashing, storage, AI, Stacks tools</div>
        </a>
        <a href="https://stacks.co" target="_blank" style="display: block; background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; text-decoration: none; transition: border-color 0.15s;">
          <div style="font-size: 18px; margin-bottom: 4px;">&#9939;</div>
          <div style="color: #fff; font-weight: 500; margin-bottom: 4px;">Stacks Blockchain</div>
          <div style="color: #71717a; font-size: 13px;">Smart contracts secured by Bitcoin</div>
        </a>
        <a href="https://github.com/coinbase/x402" target="_blank" style="display: block; background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; text-decoration: none; transition: border-color 0.15s;">
          <div style="font-size: 18px; margin-bottom: 4px;">&#128187;</div>
          <div style="color: #fff; font-weight: 500; margin-bottom: 4px;">X402 Reference</div>
          <div style="color: #71717a; font-size: 13px;">Open source reference implementation by Coinbase</div>
        </a>
      </div>
    </div>

    <div class="footer">
      <p>
        <a href="/dashboard">Dashboard</a> |
        <a href="/docs">API Docs</a> |
        <a href="/toolbox">Toolbox</a> |
        Built on <a href="https://stacks.co" target="_blank">Stacks</a>
      </p>
    </div>
  </div>
  <script>
    (function() {
      const searchInput = document.getElementById('search');
      const searchResults = document.getElementById('search-results');
      const cards = document.querySelectorAll('.category-card');
      const noResults = document.getElementById('no-results');
      const quickNav = document.getElementById('quick-nav');
      const totalCategories = cards.length;

      searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();

        if (!query) {
          // Show all cards when search is empty
          cards.forEach(card => card.classList.remove('hidden'));
          noResults.classList.remove('visible');
          quickNav.style.display = 'flex';
          searchResults.textContent = '';
          return;
        }

        let visibleCount = 0;
        cards.forEach(card => {
          const category = card.dataset.category || '';
          const endpoints = card.dataset.endpoints || '';
          const description = card.dataset.description || '';

          // Match against category name, endpoint names, or description
          const matches = category.includes(query) ||
                         endpoints.includes(query) ||
                         description.includes(query);

          if (matches) {
            card.classList.remove('hidden');
            visibleCount++;
          } else {
            card.classList.add('hidden');
          }
        });

        // Hide quick nav when searching
        quickNav.style.display = 'none';

        // Show/hide no results message
        if (visibleCount === 0) {
          noResults.classList.add('visible');
          searchResults.textContent = '';
        } else {
          noResults.classList.remove('visible');
          searchResults.textContent = visibleCount + ' of ' + totalCategories + ' categories';
        }
      });

      // Focus search on '/' key
      document.addEventListener('keydown', function(e) {
        if (e.key === '/' && document.activeElement !== searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        // Clear search on Escape
        if (e.key === 'Escape' && document.activeElement === searchInput) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
          searchInput.blur();
        }
      });
    })();
  </script>
</body>
</html>`;
}
