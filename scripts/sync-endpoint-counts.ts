#!/usr/bin/env bun
/**
 * Sync endpoint counts across all documentation files.
 *
 * Source of truth: tests/endpoint-registry.ts:ENDPOINT_COUNTS
 *
 * Usage: bun run scripts/sync-endpoint-counts.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ENDPOINT_COUNTS } from "../tests/endpoint-registry";

const ROOT = join(import.meta.dir, "..");

// Free endpoints not in test registry (health, dashboard, about, guide, toolbox)
const FREE_ENDPOINTS = 5;

// Calculate totals
const TESTED = ENDPOINT_COUNTS.total;
const TOTAL_ROUTES = TESTED + FREE_ENDPOINTS;

// Storage categories for docs/index.md combined "Storage" row
const STORAGE_CATEGORIES = [
  "kv",
  "paste",
  "counter",
  "sql",
  "links",
  "sync",
  "queue",
  "memory",
] as const;

const STORAGE_TOTAL = STORAGE_CATEGORIES.reduce(
  (sum, cat) => sum + ENDPOINT_COUNTS[cat],
  0
);

interface FileUpdate {
  path: string;
  updates: Array<{
    description: string;
    pattern: RegExp;
    replacement: string;
  }>;
}

const FILES_TO_UPDATE: FileUpdate[] = [
  // README.md - "**168 paid endpoints**"
  {
    path: "README.md",
    updates: [
      {
        description: "paid endpoints count",
        pattern: /\*\*\d+ paid endpoints\*\*/,
        replacement: `**${TESTED} paid endpoints**`,
      },
    ],
  },

  // docs/_config.yml - "171 endpoints"
  {
    path: "docs/_config.yml",
    updates: [
      {
        description: "description endpoint count",
        pattern: /micropayments - \d+ endpoints/,
        replacement: `micropayments - ${TOTAL_ROUTES} endpoints`,
      },
    ],
  },

  // docs/index.md - headline and category table
  {
    path: "docs/index.md",
    updates: [
      {
        description: "headline endpoint count",
        pattern: /\*\*\d+ endpoints\*\* across/,
        replacement: `**${TOTAL_ROUTES} endpoints** across`,
      },
      // Category table rows
      {
        description: "Stacks count",
        pattern: /\| \[Stacks\][^\|]+\| \d+ \|/,
        replacement: `| [Stacks](src/endpoints.html#stacks) | ${ENDPOINT_COUNTS.stacks} |`,
      },
      {
        description: "AI count",
        pattern: /\| \[AI\][^\|]+\| \d+ \|/,
        replacement: `| [AI](src/endpoints.html#ai) | ${ENDPOINT_COUNTS.ai} |`,
      },
      {
        description: "Text count",
        pattern: /\| \[Text\][^\|]+\| \d+ \|/,
        replacement: `| [Text](src/endpoints.html#text) | ${ENDPOINT_COUNTS.text} |`,
      },
      {
        description: "Data count",
        pattern: /\| \[Data\][^\|]+\| \d+ \|/,
        replacement: `| [Data](src/endpoints.html#data) | ${ENDPOINT_COUNTS.data} |`,
      },
      {
        description: "Random count",
        pattern: /\| \[Random\][^\|]+\| \d+ \|/,
        replacement: `| [Random](src/endpoints.html#random) | ${ENDPOINT_COUNTS.random} |`,
      },
      {
        description: "Math count",
        pattern: /\| \[Math\][^\|]+\| \d+ \|/,
        replacement: `| [Math](src/endpoints.html#math) | ${ENDPOINT_COUNTS.math} |`,
      },
      {
        description: "Utility count",
        pattern: /\| \[Utility\][^\|]+\| \d+ \|/,
        replacement: `| [Utility](src/endpoints.html#utility) | ${ENDPOINT_COUNTS.util} |`,
      },
      {
        description: "Network count",
        pattern: /\| \[Network\][^\|]+\| \d+ \|/,
        replacement: `| [Network](src/endpoints.html#network) | ${ENDPOINT_COUNTS.net} |`,
      },
      {
        description: "Crypto count",
        pattern: /\| \[Crypto\][^\|]+\| \d+ \|/,
        replacement: `| [Crypto](src/endpoints.html#crypto) | ${ENDPOINT_COUNTS.crypto} |`,
      },
      {
        description: "Registry count",
        pattern: /\| \[Registry\][^\|]+\| \d+ \|/,
        replacement: `| [Registry](src/endpoints.html#registry) | ${ENDPOINT_COUNTS.registry} |`,
      },
      {
        description: "Storage count",
        pattern: /\| \[Storage\][^\|]+\| \d+ \|/,
        replacement: `| [Storage](src/endpoints.html#storage) | ${STORAGE_TOTAL} |`,
      },
      {
        description: "Agent count",
        pattern: /\| \[Agent\][^\|]+\| \d+ \|/,
        replacement: `| [Agent](src/endpoints.html#agent) | ${ENDPOINT_COUNTS.agent} |`,
      },
    ],
  },

  // docs/src.md - "171 endpoint implementations"
  {
    path: "docs/src.md",
    updates: [
      {
        description: "endpoint implementations count",
        pattern: /\| \[`endpoints\/`\][^\|]+\| \d+ endpoint/,
        replacement: `| [\`endpoints/\`](src/endpoints.md) | ${TOTAL_ROUTES} endpoint`,
      },
    ],
  },

  // docs/src/endpoints.md - "171 API endpoint implementations"
  {
    path: "docs/src/endpoints.md",
    updates: [
      {
        description: "API endpoint implementations count",
        pattern: /> \d+ API endpoint implementations/,
        replacement: `> ${TOTAL_ROUTES} API endpoint implementations`,
      },
    ],
  },

  // CLAUDE.md - summary line and category table
  {
    path: "CLAUDE.md",
    updates: [
      {
        description: "summary counts",
        pattern:
          /\(168 tested \+ 5 free = 173 total routes\)|\(\d+ tested \+ \d+ free = \d+ total routes\)/,
        replacement: `(${TESTED} tested + ${FREE_ENDPOINTS} free = ${TOTAL_ROUTES} total routes)`,
      },
      // Category table - match by category name in first column
      {
        description: "Stacks row",
        pattern: /\| Stacks \| \d+ \|/,
        replacement: `| Stacks | ${ENDPOINT_COUNTS.stacks} |`,
      },
      {
        description: "AI row",
        pattern: /\| AI \| \d+ \|/,
        replacement: `| AI | ${ENDPOINT_COUNTS.ai} |`,
      },
      {
        description: "Text row",
        pattern: /\| Text \| \d+ \|/,
        replacement: `| Text | ${ENDPOINT_COUNTS.text} |`,
      },
      {
        description: "Data row",
        pattern: /\| Data \| \d+ \|/,
        replacement: `| Data | ${ENDPOINT_COUNTS.data} |`,
      },
      {
        description: "Crypto row",
        pattern: /\| Crypto \| \d+ \|/,
        replacement: `| Crypto | ${ENDPOINT_COUNTS.crypto} |`,
      },
      {
        description: "Random row",
        pattern: /\| Random \| \d+ \|/,
        replacement: `| Random | ${ENDPOINT_COUNTS.random} |`,
      },
      {
        description: "Math row",
        pattern: /\| Math \| \d+ \|/,
        replacement: `| Math | ${ENDPOINT_COUNTS.math} |`,
      },
      {
        description: "Utility row",
        pattern: /\| Utility \| \d+ \|/,
        replacement: `| Utility | ${ENDPOINT_COUNTS.util} |`,
      },
      {
        description: "Network row",
        pattern: /\| Network \| \d+ \|/,
        replacement: `| Network | ${ENDPOINT_COUNTS.net} |`,
      },
      {
        description: "Registry row",
        pattern: /\| Registry \| \d+ \|/,
        replacement: `| Registry | ${ENDPOINT_COUNTS.registry} |`,
      },
      {
        description: "KV Storage row",
        pattern: /\| KV Storage \| \d+ \|/,
        replacement: `| KV Storage | ${ENDPOINT_COUNTS.kv} |`,
      },
      {
        description: "Paste row",
        pattern: /\| Paste \| \d+ \|/,
        replacement: `| Paste | ${ENDPOINT_COUNTS.paste} |`,
      },
      {
        description: "Counter row",
        pattern: /\| Counter \| \d+ \|/,
        replacement: `| Counter | ${ENDPOINT_COUNTS.counter} |`,
      },
      {
        description: "SQL row",
        pattern: /\| SQL \| \d+ \|/,
        replacement: `| SQL | ${ENDPOINT_COUNTS.sql} |`,
      },
      {
        description: "Links row",
        pattern: /\| Links \| \d+ \|/,
        replacement: `| Links | ${ENDPOINT_COUNTS.links} |`,
      },
      {
        description: "Sync row",
        pattern: /\| Sync \| \d+ \|/,
        replacement: `| Sync | ${ENDPOINT_COUNTS.sync} |`,
      },
      {
        description: "Queue row",
        pattern: /\| Queue \| \d+ \|/,
        replacement: `| Queue | ${ENDPOINT_COUNTS.queue} |`,
      },
      {
        description: "Memory row",
        pattern: /\| Memory \| \d+ \|/,
        replacement: `| Memory | ${ENDPOINT_COUNTS.memory} |`,
      },
      {
        description: "Agent row",
        pattern: /\| Agent \| \d+ \|/,
        replacement: `| Agent | ${ENDPOINT_COUNTS.agent} |`,
      },
    ],
  },
];

// Track changes
interface Change {
  file: string;
  description: string;
  before: string;
  after: string;
}

const changes: Change[] = [];
const errors: string[] = [];

console.log("Syncing endpoint counts from tests/endpoint-registry.ts\n");
console.log("Source of truth:");
console.log(`  Total tested: ${TESTED}`);
console.log(`  Free endpoints: ${FREE_ENDPOINTS}`);
console.log(`  Total routes: ${TOTAL_ROUTES}`);
console.log(`  Storage total: ${STORAGE_TOTAL}`);
console.log("");

for (const file of FILES_TO_UPDATE) {
  const fullPath = join(ROOT, file.path);
  let content: string;

  try {
    content = readFileSync(fullPath, "utf-8");
  } catch (e) {
    errors.push(`Failed to read ${file.path}: ${e}`);
    continue;
  }

  let modified = content;

  for (const update of file.updates) {
    const match = modified.match(update.pattern);
    if (!match) {
      errors.push(`Pattern not found in ${file.path}: ${update.description}`);
      continue;
    }

    const before = match[0];
    const after = update.replacement;

    if (before !== after) {
      changes.push({
        file: file.path,
        description: update.description,
        before,
        after,
      });
    }

    modified = modified.replace(update.pattern, update.replacement);
  }

  if (modified !== content) {
    writeFileSync(fullPath, modified);
  }
}

// Report results
if (changes.length > 0) {
  console.log(`Updated ${changes.length} values:\n`);
  for (const change of changes) {
    console.log(`  ${change.file}: ${change.description}`);
    console.log(`    - ${change.before}`);
    console.log(`    + ${change.after}`);
  }
  console.log("");
}

if (errors.length > 0) {
  console.log(`Errors (${errors.length}):\n`);
  for (const error of errors) {
    console.log(`  - ${error}`);
  }
  console.log("");
}

if (changes.length === 0 && errors.length === 0) {
  console.log("All counts are already in sync!");
} else if (errors.length === 0) {
  console.log("Sync complete!");
} else {
  console.log("Sync completed with errors.");
  process.exit(1);
}
