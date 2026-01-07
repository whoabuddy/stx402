#!/usr/bin/env bun
/**
 * Backfill created dates for endpoint metrics from git history.
 *
 * Usage:
 *   bun run scripts/backfill-created-dates.ts          # Generate JSON mapping
 *   bun run scripts/backfill-created-dates.ts --apply  # Apply to production KV
 */

import { execSync } from "child_process";
import { ENDPOINT_TIERS } from "../src/utils/pricing";

const ROOT = import.meta.dir + "/..";

// Get all endpoint paths from pricing tiers
const endpointPaths = Object.keys(ENDPOINT_TIERS);

// Map endpoint path to likely source file
function pathToFilename(path: string): string[] {
  // /api/text/diff -> textDiff.ts
  // /api/stacks/bns-name -> stacksBnsName.ts
  // /api/kv/set -> kv/kvSet.ts
  const parts = path.replace("/api/", "").split("/");

  const candidates: string[] = [];

  if (parts.length === 2) {
    const [category, name] = parts;
    // Convert kebab-case to camelCase
    const camelName = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const pascalName = camelName.charAt(0).toUpperCase() + camelName.slice(1);

    // Try different patterns
    candidates.push(`${category}${pascalName}.ts`); // textDiff.ts
    candidates.push(`${category}/${category}${pascalName}.ts`); // kv/kvSet.ts
    candidates.push(`${category}/${pascalName}.ts`); // counter/Increment.ts
  } else if (parts.length === 3) {
    // /api/agent/identity/register -> agent/identityRegister.ts
    const [category, sub, action] = parts;
    const camelAction = action.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const pascalAction = camelAction.charAt(0).toUpperCase() + camelAction.slice(1);
    const camelSub = sub.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const pascalSub = camelSub.charAt(0).toUpperCase() + camelSub.slice(1);

    candidates.push(`${category}/${camelSub}${pascalAction}.ts`);
    candidates.push(`${category}/${pascalSub}${pascalAction}.ts`);
  }

  return candidates;
}

// Get first commit date for a file pattern
function getFirstCommitDate(filePattern: string): string | null {
  try {
    // Get the first commit that added this file
    const result = execSync(
      `git log --diff-filter=A --format="%aI" --reverse -- "src/endpoints/${filePattern}" 2>/dev/null | head -1`,
      { cwd: ROOT, encoding: "utf-8" }
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}

// Build the mapping
const createdDates: Record<string, string> = {};
const notFound: string[] = [];

console.log("Scanning git history for endpoint creation dates...\n");

for (const path of endpointPaths) {
  const candidates = pathToFilename(path);
  let found = false;

  for (const candidate of candidates) {
    const date = getFirstCommitDate(candidate);
    if (date) {
      createdDates[path] = date;
      found = true;
      break;
    }
  }

  if (!found) {
    // Try a broader search using the endpoint name
    const name = path.split("/").pop() || "";
    const camelName = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const date = getFirstCommitDate(`*${camelName}*.ts`);
    if (date) {
      createdDates[path] = date;
      found = true;
    }
  }

  if (!found) {
    notFound.push(path);
  }
}

// For endpoints we couldn't find, use a reasonable default based on category
// Group by category and assign dates spreading across early development period
const categoryFirstDates: Record<string, string> = {};
for (const [path, date] of Object.entries(createdDates)) {
  const category = path.split("/")[2]; // /api/CATEGORY/...
  if (!categoryFirstDates[category] || date < categoryFirstDates[category]) {
    categoryFirstDates[category] = date;
  }
}

// Assign not-found endpoints the earliest date from their category
for (const path of notFound) {
  const category = path.split("/")[2];
  if (categoryFirstDates[category]) {
    createdDates[path] = categoryFirstDates[category];
  } else {
    // Fallback to earliest known date
    const earliest = Object.values(createdDates).sort()[0] || new Date().toISOString();
    createdDates[path] = earliest;
  }
}

// Sort by date for nice output
const sorted = Object.entries(createdDates).sort((a, b) => a[1].localeCompare(b[1]));

console.log(`Found dates for ${Object.keys(createdDates).length} endpoints`);
if (notFound.length > 0) {
  console.log(`Used category fallback for ${notFound.length} endpoints: ${notFound.slice(0, 5).join(", ")}${notFound.length > 5 ? "..." : ""}`);
}
console.log("");

// Group by date for summary
const byDate: Record<string, string[]> = {};
for (const [path, date] of sorted) {
  const day = date.split("T")[0];
  if (!byDate[day]) byDate[day] = [];
  byDate[day].push(path);
}

console.log("Endpoints by creation date:");
for (const [day, paths] of Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${day}: ${paths.length} endpoints`);
}

// Check for --apply flag
if (process.argv.includes("--apply")) {
  console.log("\n--apply flag detected");
  console.log("To apply these dates, you need to update the METRICS KV.");
  console.log("This requires running against the Cloudflare API or using wrangler.");
  console.log("\nGenerated JSON for manual application:");
  console.log(JSON.stringify(createdDates, null, 2));
} else {
  console.log("\nTo see the full mapping, run with --apply flag");
  console.log("JSON output:");
  console.log(JSON.stringify(Object.fromEntries(sorted), null, 2));
}
