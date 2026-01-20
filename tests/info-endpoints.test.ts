/**
 * Info Endpoints Test
 *
 * Tests free info/documentation endpoints that don't require payment.
 * Run directly: bun run tests/info-endpoints.test.ts
 */

import { COLORS, X402_WORKER_URL } from "./_shared_utils";

interface InfoEndpointTest {
  name: string;
  path: string;
  method: "GET";
  expectedContentType: "application/json" | "text/html" | "image/svg+xml";
  validate: (response: Response, body: string) => boolean;
}

const INFO_ENDPOINTS: InfoEndpointTest[] = [
  {
    name: "root",
    path: "/",
    method: "GET",
    expectedContentType: "application/json",
    validate: (res, body) => {
      if (res.status !== 200) return false;
      try {
        const data = JSON.parse(body);
        return (
          data.service === "stx402-directory" &&
          typeof data.version === "string" &&
          typeof data.docs === "string" &&
          typeof data.categories === "object"
        );
      } catch {
        return false;
      }
    },
  },
  {
    name: "health",
    path: "/health",
    method: "GET",
    expectedContentType: "application/json",
    validate: (res, body) => {
      if (res.status !== 200) return false;
      try {
        const data = JSON.parse(body);
        return data.status === "ok" && typeof data.details === "object";
      } catch {
        return false;
      }
    },
  },
  {
    name: "dashboard",
    path: "/dashboard",
    method: "GET",
    expectedContentType: "text/html",
    validate: (res, body) => {
      if (res.status !== 200) return false;
      return (
        body.includes("<!DOCTYPE html>") &&
        body.includes("Dashboard") &&
        body.includes("STX402")
      );
    },
  },
  {
    name: "guide",
    path: "/guide",
    method: "GET",
    expectedContentType: "text/html",
    validate: (res, body) => {
      if (res.status !== 200) return false;
      return (
        body.includes("<!DOCTYPE html>") &&
        body.includes("Guide") &&
        body.includes("STX402") &&
        body.includes("Why register?")
      );
    },
  },
  {
    name: "toolbox",
    path: "/toolbox",
    method: "GET",
    expectedContentType: "text/html",
    validate: (res, body) => {
      if (res.status !== 200) return false;
      return (
        body.includes("<!DOCTYPE html>") &&
        body.includes("Toolbox") &&
        body.includes("402")
      );
    },
  },
  {
    name: "favicon.svg",
    path: "/favicon.svg",
    method: "GET",
    expectedContentType: "image/svg+xml",
    validate: (res, body) => {
      if (res.status !== 200) return false;
      return body.includes("<svg") && body.includes("</svg>");
    },
  },
  {
    name: "docs (redirect)",
    path: "/docs",
    method: "GET",
    expectedContentType: "text/html",
    validate: (res, body) => {
      // Swagger UI returns HTML
      if (res.status !== 200) return false;
      return body.includes("swagger") || body.includes("Swagger") || body.includes("openapi");
    },
  },
  {
    name: "openapi.json",
    path: "/openapi.json",
    method: "GET",
    expectedContentType: "application/json",
    validate: (res, body) => {
      if (res.status !== 200) return false;
      try {
        const data = JSON.parse(body);
        return (
          data.openapi?.startsWith("3.") &&
          data.info?.title === "STX402 Directory API" &&
          Array.isArray(data.tags) &&
          data.tags.length >= 7 // We added 3 new tags
        );
      } catch {
        return false;
      }
    },
  },
];

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function runInfoEndpointTests(verbose = false): Promise<{
  passed: number;
  total: number;
  success: boolean;
  results: TestResult[];
}> {
  console.log(`\n${COLORS.bright}${"=".repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  INFO ENDPOINTS TEST${COLORS.reset}`);
  console.log(`${COLORS.bright}${"=".repeat(60)}${COLORS.reset}`);
  console.log(`  Server: ${X402_WORKER_URL}`);
  console.log(`  Tests:  ${INFO_ENDPOINTS.length} endpoints`);
  console.log(`${COLORS.bright}${"=".repeat(60)}${COLORS.reset}\n`);

  const results: TestResult[] = [];

  for (const test of INFO_ENDPOINTS) {
    const url = `${X402_WORKER_URL}${test.path}`;

    try {
      const res = await fetch(url, { method: test.method });
      const body = await res.text();
      const contentType = res.headers.get("content-type") || "";

      // Check content type
      const contentTypeMatch = contentType.includes(test.expectedContentType.split("/")[0]);

      if (!contentTypeMatch && verbose) {
        console.log(`  ${COLORS.yellow}Warning: ${test.name} content-type is ${contentType}${COLORS.reset}`);
      }

      const passed = test.validate(res, body);

      if (passed) {
        console.log(`  ${COLORS.green}[PASS]${COLORS.reset} ${test.name} (${test.path})`);
        results.push({ name: test.name, passed: true });
      } else {
        const error = `Status: ${res.status}, Content-Type: ${contentType}`;
        console.log(`  ${COLORS.red}[FAIL]${COLORS.reset} ${test.name} (${test.path})`);
        if (verbose) {
          console.log(`    ${COLORS.gray}${error}${COLORS.reset}`);
          console.log(`    ${COLORS.gray}Body (first 200 chars): ${body.slice(0, 200)}${COLORS.reset}`);
        }
        results.push({ name: test.name, passed: false, error });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ${COLORS.red}[FAIL]${COLORS.reset} ${test.name} (${test.path})`);
      console.log(`    ${COLORS.gray}Error: ${errorMsg}${COLORS.reset}`);
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
export { runInfoEndpointTests, INFO_ENDPOINTS };

// Run directly
if (import.meta.main) {
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");
  runInfoEndpointTests(verbose)
    .then(({ success }) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}
