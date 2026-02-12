/**
 * Endpoint Count Validator
 *
 * Validates that the test registry stays in sync with actual routes in index.ts.
 * This is a sanity check to catch major drift (>5 endpoints difference).
 *
 * Note: Some endpoints have multiple test configs (e.g., different params),
 * and some routes have path parameters that match differently. The validation
 * allows for minor differences.
 *
 * Usage:
 *   bun run tests/_validate_endpoints.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { ENDPOINT_COUNTS, ENDPOINT_REGISTRY } from "./endpoint-registry";

// =============================================================================
// Constants
// =============================================================================

// Free OpenAPI endpoints not in the test registry (no payment required)
// Note: favicon routes use app.get() not openapi.get() so they're not counted here
const FREE_ENDPOINTS = [
  "/health",
  "/dashboard",
  "/guide",
  "/toolbox",
  "/x402.json",
  "/agent/registry",
];

// =============================================================================
// Validation
// =============================================================================

interface ValidationResult {
  valid: boolean;
  indexRouteCount: number;
  registryTestCount: number;
  uniqueTestRoutes: number;
  freeEndpointCount: number;
  expectedTotal: number;
  difference: number;
  errors: string[];
  warnings: string[];
}

/**
 * Count routes registered in index.ts by parsing the source
 */
function countIndexRoutes(): number {
  const indexPath = resolve(__dirname, "../src/index.ts");
  const content = readFileSync(indexPath, "utf-8");

  // Match openapi.get/post/put/delete calls
  const routePattern = /openapi\.(get|post|put|delete)\s*\(/g;
  const matches = content.match(routePattern);

  return matches ? matches.length : 0;
}

/**
 * Count unique base routes in the test registry
 * (strips query params and replaces path params with placeholder)
 */
function countUniqueTestRoutes(): number {
  const uniqueRoutes = new Set<string>();

  for (const config of ENDPOINT_REGISTRY) {
    // Normalize: strip query params, replace path segments that look like values
    let normalized = config.endpoint.split("?")[0];
    // Replace hex values, addresses, uuids, etc. with :param
    normalized = normalized
      .replace(/\/SP[A-Z0-9]+/g, "/:address")
      .replace(/\/ST[A-Z0-9]+/g, "/:address")
      .replace(/\/0x[a-fA-F0-9]+/g, "/:hex")
      .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-/g, "/:uuid-")
      .replace(/\.[a-z-]+$/i, ".:name"); // contract names

    uniqueRoutes.add(normalized);
  }

  return uniqueRoutes.size;
}

/**
 * Validate endpoint counts match between registry and index.ts
 */
export function validateEndpointCounts(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Count routes in index.ts
  const indexRouteCount = countIndexRoutes();

  // Count tests in registry
  const registryTestCount = ENDPOINT_REGISTRY.length;
  const uniqueTestRoutes = countUniqueTestRoutes();

  // Free endpoints (not in test registry)
  const freeEndpointCount = FREE_ENDPOINTS.length;

  // Expected total: unique tested routes + free OpenAPI endpoints
  const expectedTotal = uniqueTestRoutes + freeEndpointCount;

  const difference = indexRouteCount - expectedTotal;

  // Validate category counts match
  const categoryTotal = Object.values(ENDPOINT_COUNTS).reduce(
    (sum, count) => (typeof count === "number" && count !== ENDPOINT_COUNTS.total ? sum + count : sum),
    0
  );

  if (categoryTotal !== ENDPOINT_COUNTS.total) {
    errors.push(
      `Category sum (${categoryTotal}) doesn't match ENDPOINT_COUNTS.total (${ENDPOINT_COUNTS.total})`
    );
  }

  // Check for significant drift
  if (Math.abs(difference) > 5) {
    errors.push(
      `Large drift detected: index.ts has ${indexRouteCount} routes, ` +
        `expected ${expectedTotal} (registry: ${registryTestCount} + free: ${freeEndpointCount})`
    );
  } else if (difference !== 0) {
    warnings.push(
      `Minor drift: index.ts has ${indexRouteCount} routes, ` +
        `expected ${expectedTotal} (diff: ${difference > 0 ? "+" : ""}${difference})`
    );
  }

  return {
    valid: errors.length === 0,
    indexRouteCount,
    registryTestCount,
    uniqueTestRoutes,
    freeEndpointCount,
    expectedTotal,
    difference,
    errors,
    warnings,
  };
}

// =============================================================================
// CLI
// =============================================================================

if (require.main === module) {
  const result = validateEndpointCounts();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ENDPOINT COUNT VALIDATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log(`  Routes in index.ts:     ${result.indexRouteCount}`);
  console.log(`  Test configs:           ${result.registryTestCount}`);
  console.log(`  Unique tested routes:   ${result.uniqueTestRoutes}`);
  console.log(`  Free endpoints:         ${result.freeEndpointCount}`);
  console.log(`  Expected total:         ${result.expectedTotal}`);
  console.log(`  Difference:             ${result.difference > 0 ? "+" : ""}${result.difference}`);

  if (result.warnings.length > 0) {
    console.log("\n  ⚠️  Warnings:");
    result.warnings.forEach((w) => console.log(`      ${w}`));
  }

  if (result.errors.length > 0) {
    console.log("\n  ❌ Errors:");
    result.errors.forEach((e) => console.log(`      ${e}`));
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (result.valid) {
    console.log("  ✅ Validation PASSED");
  } else {
    console.log("  ❌ Validation FAILED");
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  process.exit(result.valid ? 0 : 1);
}
