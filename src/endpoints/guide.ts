import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";
import { getNavCSS, getNavHTML } from "../components/nav";

export class GuidePage extends OpenAPIRoute {
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
    name: "Stacks",
    color: "#f7931a",
    icon: "&#9939;",
    description: "Stacks blockchain queries and Clarity smart contract utilities",
    useFor: "Resolving BNS names, validating addresses, reading contract source/ABI, decoding Clarity values, calling read-only functions",
    examples: [
      { path: "/api/stacks/get-bns-name/:address", name: "get-bns-name" },
      { path: "/api/stacks/contract-source/:contract_id", name: "contract-source" },
      { path: "/api/stacks/call-readonly", name: "call-readonly" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
  {
    name: "AI",
    color: "#3b82f6",
    icon: "&#129302;",
    description: "AI-powered text analysis, generation, and media processing",
    useFor: "Summarizing text, sentiment analysis, translation, text-to-speech, image generation, smart contract explanations",
    examples: [
      { path: "/api/ai/summarize", name: "summarize" },
      { path: "/api/ai/sentiment", name: "sentiment" },
      { path: "/api/ai/generate-image", name: "generate-image" },
    ],
    tier: "ai / heavy_ai",
    tierPrice: "0.003-0.01 STX",
  },
  {
    name: "Text",
    color: "#06b6d4",
    icon: "&#128221;",
    description: "Text encoding, hashing, and transformation utilities",
    useFor: "Base64/URL/hex encoding, SHA256/Keccak hashes (Clarity-compatible), case conversion, word count, regex testing",
    examples: [
      { path: "/api/text/sha256", name: "sha256" },
      { path: "/api/text/base64-encode", name: "base64-encode" },
      { path: "/api/text/hash160", name: "hash160" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
  {
    name: "Data",
    color: "#3b82f6",
    icon: "&#128202;",
    description: "JSON and CSV data transformation and validation",
    useFor: "Converting CSV to JSON, formatting/minifying JSON, validating JSON, querying with JSONPath, flattening nested objects",
    examples: [
      { path: "/api/data/csv-to-json", name: "csv-to-json" },
      { path: "/api/data/json-validate", name: "json-validate" },
      { path: "/api/data/json-path", name: "json-path" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
  {
    name: "Crypto",
    color: "#fb923c",
    icon: "&#128272;",
    description: "Cryptographic operations and random byte generation",
    useFor: "RIPEMD-160 hashing, cryptographically secure random bytes",
    examples: [
      { path: "/api/crypto/ripemd160", name: "ripemd160" },
      { path: "/api/crypto/random-bytes", name: "random-bytes" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
  {
    name: "Random",
    color: "#0ea5e9",
    icon: "&#127922;",
    description: "Secure random generation for various formats",
    useFor: "UUIDs, random numbers in ranges, random strings, secure passwords, dice rolls, array shuffling",
    examples: [
      { path: "/api/random/uuid", name: "uuid" },
      { path: "/api/random/password", name: "password" },
      { path: "/api/random/shuffle", name: "shuffle" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
  {
    name: "Math",
    color: "#6366f1",
    icon: "&#128290;",
    description: "Mathematical operations and calculations",
    useFor: "Expression evaluation, percentage calculations, statistics (mean/median/mode), prime checking, GCD/LCM, factorials",
    examples: [
      { path: "/api/math/calculate", name: "calculate" },
      { path: "/api/math/statistics", name: "statistics" },
      { path: "/api/math/prime-check", name: "prime-check" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
  {
    name: "Utility",
    color: "#22d3ee",
    icon: "&#128295;",
    description: "General-purpose utilities for common tasks",
    useFor: "Timestamps, DNS lookups, QR code generation, URL parsing, markdown to HTML, email validation, signature verification",
    examples: [
      { path: "/api/util/timestamp", name: "timestamp" },
      { path: "/api/util/qr-generate", name: "qr-generate" },
      { path: "/api/util/verify-signature", name: "verify-signature" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
  {
    name: "Network",
    color: "#10b981",
    icon: "&#127760;",
    description: "Network utilities and request analysis",
    useFor: "Geo-IP lookup, ASN information, request fingerprinting, HTTP probing, CORS proxy, SSL certificate checks",
    examples: [
      { path: "/api/net/geo-ip", name: "geo-ip" },
      { path: "/api/net/ssl-check", name: "ssl-check" },
      { path: "/api/net/cors-proxy", name: "cors-proxy" },
    ],
    tier: "simple",
    tierPrice: "0.001 STX",
  },
  {
    name: "Registry",
    color: "#f59e0b",
    icon: "&#128218;",
    description: "X402 endpoint discovery and registration",
    useFor: "Registering your X402 endpoints, probing payment requirements, listing available endpoints, managing ownership",
    examples: [
      { path: "/api/registry/list", name: "list (free)" },
      { path: "/api/registry/register", name: "register" },
      { path: "/api/registry/probe", name: "probe" },
    ],
    tier: "ai / free",
    tierPrice: "0.003 STX or free",
  },
  {
    name: "KV Storage",
    color: "#8b5cf6",
    icon: "&#128451;",
    description: "Persistent key-value storage namespaced to your wallet",
    useFor: "Storing and retrieving data by key, listing keys with prefixes, deleting entries",
    examples: [
      { path: "/api/kv/set", name: "set" },
      { path: "/api/kv/get", name: "get" },
      { path: "/api/kv/list", name: "list" },
    ],
    tier: "storage_read/write",
    tierPrice: "0.0005-0.005 STX",
  },
  {
    name: "Paste",
    color: "#ec4899",
    icon: "&#128203;",
    description: "Text paste bin with short codes",
    useFor: "Creating shareable text snippets with auto-generated short codes, retrieving pastes, deleting your pastes",
    examples: [
      { path: "/api/paste/create", name: "create" },
      { path: "/api/paste/:code", name: "get" },
      { path: "/api/paste/delete", name: "delete" },
    ],
    tier: "storage_read/write",
    tierPrice: "0.0005-0.001 STX",
  },
  {
    name: "Counter",
    color: "#14b8a6",
    icon: "&#127922;",
    description: "Atomic counters with increment/decrement operations",
    useFor: "Tracking counts, incrementing/decrementing values atomically, resetting counters, listing all your counters",
    examples: [
      { path: "/api/counter/increment", name: "increment" },
      { path: "/api/counter/get", name: "get" },
      { path: "/api/counter/list", name: "list" },
    ],
    tier: "storage_read/write",
    tierPrice: "0.0005-0.001 STX",
  },
  {
    name: "SQL",
    color: "#0891b2",
    icon: "&#128451;",
    description: "Direct SQLite database access in your personal namespace",
    useFor: "Running SQL queries, executing DDL/DML statements, viewing your schema",
    examples: [
      { path: "/api/sql/query", name: "query" },
      { path: "/api/sql/execute", name: "execute" },
      { path: "/api/sql/schema", name: "schema" },
    ],
    tier: "storage_read/write",
    tierPrice: "0.0005-0.001 STX",
  },
  {
    name: "Links",
    color: "#f472b6",
    icon: "&#128279;",
    description: "URL shortener with click tracking",
    useFor: "Creating short links, expanding slugs to original URLs, viewing click statistics, managing your links",
    examples: [
      { path: "/api/links/create", name: "create" },
      { path: "/api/links/expand/:slug", name: "expand (free)" },
      { path: "/api/links/stats", name: "stats" },
    ],
    tier: "storage_read/write",
    tierPrice: "0.0005-0.001 STX",
  },
  {
    name: "Sync",
    color: "#facc15",
    icon: "&#128274;",
    description: "Distributed locks with auto-expiration",
    useFor: "Acquiring locks for coordination, releasing locks, checking lock status, extending lock TTL",
    examples: [
      { path: "/api/sync/lock", name: "lock" },
      { path: "/api/sync/unlock", name: "unlock" },
      { path: "/api/sync/check", name: "check" },
    ],
    tier: "storage_read/write",
    tierPrice: "0.0005-0.001 STX",
  },
  {
    name: "Queue",
    color: "#f97316",
    icon: "&#128203;",
    description: "Job queue with priority and retry support",
    useFor: "Pushing jobs to a queue, popping jobs for processing, marking jobs complete or failed, checking queue status",
    examples: [
      { path: "/api/queue/push", name: "push" },
      { path: "/api/queue/pop", name: "pop" },
      { path: "/api/queue/status", name: "status" },
    ],
    tier: "storage_read/write",
    tierPrice: "0.0005-0.001 STX",
  },
  {
    name: "Memory",
    color: "#a78bfa",
    icon: "&#129504;",
    description: "Agent memory with semantic search (AI embeddings)",
    useFor: "Storing memories with embeddings, recalling by ID, semantic search across memories, forgetting entries",
    examples: [
      { path: "/api/memory/store", name: "store" },
      { path: "/api/memory/search", name: "search" },
      { path: "/api/memory/recall", name: "recall" },
    ],
    tier: "storage_ai",
    tierPrice: "0.003 STX",
  },
  {
    name: "Agent",
    color: "#34d399",
    icon: "&#129302;",
    description: "ERC-8004 agent registry for AI agent identity and reputation",
    useFor: "Registering AI agents, querying agent metadata, viewing reputation scores, checking validation status",
    examples: [
      { path: "/api/agent/info", name: "info" },
      { path: "/api/agent/reputation/summary", name: "reputation" },
      { path: "/api/agent/registry", name: "registry (free)" },
    ],
    tier: "simple / free",
    tierPrice: "0.001 STX or free",
  },
];

function generateGuideHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Endpoint Guide - STX402</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23f7931a' rx='12' width='100' height='100'/><text x='50' y='68' font-size='40' font-weight='800' text-anchor='middle' fill='%23000'>402</text></svg>">
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
    <h1><span class="accent">STX402</span> Guide</h1>
    <p class="subtitle">168 endpoints across 19 categories - find what you need</p>

    <div class="intro">
      <p>
        Each category groups related functionality. All endpoints return JSON and accept
        <strong>STX</strong>, <strong>sBTC</strong>, or <strong>USDCx</strong> for payment.
        Click any endpoint to view its full documentation in the API docs.
      </p>
    </div>

    <div class="intro" style="border-color: #3b82f6;">
      <p>
        <strong style="color: #3b82f6;">&#128274; Per-Payer Namespacing:</strong> Storage endpoints
        (KV, SQL, Counter, Links, Sync, Queue, Memory, Paste) are automatically isolated by your
        payment address. Your data is private — no configuration needed. Two users calling the
        same endpoint get their own separate storage.
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
            ${c.examples.map(e => `<a href="/#/operations/${e.name}" class="example">${e.name}</a>`).join("")}
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

    <div class="footer">
      <p>
        <a href="/about">About X402</a> |
        <a href="/dashboard">Dashboard</a> |
        <a href="/">API Docs</a> |
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
