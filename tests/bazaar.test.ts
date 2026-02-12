/**
 * Bazaar Extensions Test
 *
 * Tests that 402 responses include the Bazaar extension with discovery metadata.
 * Verifies that AI agents can understand endpoint capabilities from 402 responses.
 *
 * Run directly: bun run tests/bazaar.test.ts
 */

import { COLORS, X402_WORKER_URL } from "./_shared_utils";

interface BazaarEndpointTest {
  name: string;
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  category: string;
}

const BAZAAR_ENDPOINTS: BazaarEndpointTest[] = [
  {
    name: "agent-version",
    path: "/agent/version?network=testnet",
    method: "GET",
    category: "agent",
  },
  {
    name: "registry-probe",
    path: "/registry/probe",
    method: "POST",
    body: { url: "https://example.com/api/test" },
    category: "registry",
  },
  {
    name: "links-create",
    path: "/links/create",
    method: "POST",
    body: { url: "https://example.com", title: "Example" },
    category: "links",
  },
];

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function runBazaarTests(verbose = false): Promise<{
  passed: number;
  total: number;
  success: boolean;
  results: TestResult[];
}> {
  console.log(`\n${COLORS.bright}${"=".repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  BAZAAR EXTENSIONS TEST${COLORS.reset}`);
  console.log(`${COLORS.bright}${"=".repeat(60)}${COLORS.reset}`);
  console.log(`  Server: ${X402_WORKER_URL}`);
  console.log(`  Tests:  ${BAZAAR_ENDPOINTS.length} endpoints`);
  console.log(`${COLORS.bright}${"=".repeat(60)}${COLORS.reset}\n`);

  const results: TestResult[] = [];

  for (const test of BAZAAR_ENDPOINTS) {
    const url = `${X402_WORKER_URL}${test.path}`;

    try {
      // Hit endpoint WITHOUT payment header (expect 402)
      const res = await fetch(url, {
        method: test.method,
        headers: test.body ? { "Content-Type": "application/json" } : {},
        body: test.body ? JSON.stringify(test.body) : undefined,
      });

      // Should return 402
      if (res.status !== 402) {
        const error = `Expected 402, got ${res.status}`;
        console.log(`  ${COLORS.red}[FAIL]${COLORS.reset} ${test.name}: ${error}`);
        results.push({ name: test.name, passed: false, error });
        continue;
      }

      // Parse response
      const data = await res.json();

      // Validate Bazaar extension structure
      const errors: string[] = [];

      // Check extensions.bazaar exists
      if (!data.extensions?.bazaar) {
        errors.push("missing extensions.bazaar");
      } else {
        const bazaar = data.extensions.bazaar;

        // Check info.input
        if (!bazaar.info?.input) {
          errors.push("missing bazaar.info.input");
        } else {
          const input = bazaar.info.input;
          if (input.type !== "http") {
            errors.push(`input.type is "${input.type}", expected "http"`);
          }
          if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(input.method)) {
            errors.push(`input.method is "${input.method}"`);
          }
        }

        // Check info.output
        if (!bazaar.info?.output) {
          errors.push("missing bazaar.info.output");
        } else {
          const output = bazaar.info.output;
          if (output.type !== "json") {
            errors.push(`output.type is "${output.type}", expected "json"`);
          }
          if (typeof output.example !== "object" || output.example === null) {
            errors.push("output.example is not an object");
          }
        }

        // Check schema
        if (!bazaar.schema) {
          errors.push("missing bazaar.schema");
        } else {
          const schema = bazaar.schema;
          if (!schema.$schema?.includes("json-schema.org")) {
            errors.push("schema.$schema is invalid");
          }
          if (schema.type !== "object") {
            errors.push(`schema.type is "${schema.type}", expected "object"`);
          }
          if (!schema.properties || typeof schema.properties !== "object") {
            errors.push("schema.properties is missing or invalid");
          }
        }
      }

      if (errors.length === 0) {
        console.log(`  ${COLORS.green}[PASS]${COLORS.reset} ${test.name} (${test.category})`);
        results.push({ name: test.name, passed: true });
      } else {
        const error = errors.join("; ");
        console.log(`  ${COLORS.red}[FAIL]${COLORS.reset} ${test.name}: ${error}`);
        if (verbose) {
          console.log(`    ${COLORS.gray}Response: ${JSON.stringify(data, null, 2).slice(0, 500)}${COLORS.reset}`);
        }
        results.push({ name: test.name, passed: false, error });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ${COLORS.red}[FAIL]${COLORS.reset} ${test.name}: ${errorMsg}`);
      results.push({ name: test.name, passed: false, error: errorMsg });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const success = passed === total;

  console.log(`\n${COLORS.bright}${"=".repeat(60)}${COLORS.reset}`);
  const color = success ? COLORS.green : COLORS.red;
  console.log(`  ${color}${COLORS.bright}${passed}/${total} passed${COLORS.reset}`);
  console.log(`${COLORS.bright}${"=".repeat(60)}${COLORS.reset}\n`);

  return { passed, total, success, results };
}

// Export for use by other test runners
export { runBazaarTests, BAZAAR_ENDPOINTS };

// Run directly
if (import.meta.main) {
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");
  runBazaarTests(verbose)
    .then(({ success }) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}
