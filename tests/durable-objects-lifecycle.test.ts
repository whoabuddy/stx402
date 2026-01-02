/**
 * Durable Objects Lifecycle Tests (Counter + SQL)
 *
 * Tests the full lifecycle of Counter and SQL endpoints:
 *
 * Counter Tests:
 * 1. Increment - create a new counter
 * 2. Get - retrieve counter value
 * 3. Increment with bounds - test min/max capping
 * 4. Decrement - decrease counter
 * 5. Reset - reset to specific value
 * 6. List - list all counters
 * 7. Delete - remove counter
 *
 * SQL Tests:
 * 8. Schema - get initial schema
 * 9. Execute - create custom table
 * 10. Execute - insert data
 * 11. Query - select data
 * 12. Schema - verify new table exists
 *
 * Usage:
 *   bun run tests/durable-objects-lifecycle.test.ts
 *
 * Environment:
 *   X402_CLIENT_PK  - Mnemonic for payments (required)
 *   X402_WORKER_URL - API URL (default: http://localhost:8787)
 *   VERBOSE=1       - Enable verbose logging
 */

import type { TokenType, NetworkType } from "x402-stacks";
import { X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import {
  COLORS,
  X402_CLIENT_PK,
  X402_NETWORK,
  X402_WORKER_URL,
} from "./_shared_utils";

// =============================================================================
// Configuration
// =============================================================================

const VERBOSE = process.env.VERBOSE === "1";
const TOKEN_TYPE: TokenType = "STX";

// Unique counter name for this test run
const TEST_COUNTER_NAME = `test-counter-${Date.now()}`;
const TEST_TABLE_NAME = `test_table_${Date.now()}`;

// =============================================================================
// Test Helpers
// =============================================================================

function log(message: string, ...args: unknown[]) {
  if (VERBOSE) {
    console.log(`  ${COLORS.gray}${message}${COLORS.reset}`, ...args);
  }
}

function logStep(step: number, total: number, name: string) {
  console.log(`\n${COLORS.bright}[${step}/${total}]${COLORS.reset} ${COLORS.cyan}${name}${COLORS.reset}`);
}

function logSuccess(message: string) {
  console.log(`  ${COLORS.green}✓${COLORS.reset} ${message}`);
}

function logError(message: string) {
  console.log(`  ${COLORS.red}✗${COLORS.reset} ${message}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// =============================================================================
// X402 Payment Flow
// =============================================================================

interface PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
}

async function makeX402Request(
  endpoint: string,
  method: "GET" | "POST",
  x402Client: X402PaymentClient,
  body?: unknown
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const fullUrl = `${X402_WORKER_URL}${endpoint}`;
  const tokenParam = endpoint.includes("?") ? `&tokenType=${TOKEN_TYPE}` : `?tokenType=${TOKEN_TYPE}`;

  log(`Requesting ${method} ${endpoint}...`);

  const initialRes = await fetch(`${fullUrl}${tokenParam}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  // If not 402, return as-is
  if (initialRes.status !== 402) {
    let data: unknown;
    const text = await initialRes.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: initialRes.status, data, headers: initialRes.headers };
  }

  // Get payment requirements
  const paymentText = await initialRes.text();
  const paymentReq: PaymentRequired = JSON.parse(paymentText);
  log(`Payment required: ${paymentReq.maxAmountRequired} ${paymentReq.tokenType}`);

  // Sign payment
  const signResult = await x402Client.signPayment(paymentReq);
  log("Payment signed");

  // Retry with payment
  const paidRes = await fetch(`${fullUrl}${tokenParam}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      "X-PAYMENT": signResult.signedTransaction,
      "X-PAYMENT-TOKEN-TYPE": TOKEN_TYPE,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown;
  const responseText = await paidRes.text();
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }
  return { status: paidRes.status, data, headers: paidRes.headers };
}

// =============================================================================
// Test Context
// =============================================================================

interface TestContext {
  x402Client: X402PaymentClient;
  ownerAddress: string;
  network: "mainnet" | "testnet";
}

// =============================================================================
// Counter Tests
// =============================================================================

async function testCounterIncrement(ctx: TestContext): Promise<boolean> {
  logStep(1, 12, "Counter: Increment (create new)");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/increment",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME, step: 5 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { name: string; value: number; previousValue: number; capped: boolean };
    if (result.name !== TEST_COUNTER_NAME) {
      logError(`Name mismatch: ${result.name}`);
      return false;
    }
    if (result.previousValue !== 0) {
      logError(`Expected previousValue 0, got ${result.previousValue}`);
      return false;
    }
    if (result.value !== 5) {
      logError(`Expected value 5, got ${result.value}`);
      return false;
    }

    logSuccess(`Created counter: ${result.name} = ${result.value}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterGet(ctx: TestContext): Promise<boolean> {
  logStep(2, 12, "Counter: Get");

  try {
    const { status, data } = await makeX402Request(
      `/api/counter/get?name=${encodeURIComponent(TEST_COUNTER_NAME)}`,
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { name: string; value: number; createdAt: string; updatedAt: string };
    if (result.value !== 5) {
      logError(`Expected value 5, got ${result.value}`);
      return false;
    }

    logSuccess(`Got counter: ${result.name} = ${result.value} (created: ${result.createdAt})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterIncrementWithBounds(ctx: TestContext): Promise<boolean> {
  logStep(3, 12, "Counter: Increment with max bound");

  try {
    // Set max to 8, increment by 10 - should cap at 8
    const { status, data } = await makeX402Request(
      "/api/counter/increment",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME, step: 10, max: 8 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { value: number; previousValue: number; capped: boolean };
    if (result.value !== 8) {
      logError(`Expected value capped at 8, got ${result.value}`);
      return false;
    }
    if (!result.capped) {
      logError(`Expected capped=true`);
      return false;
    }

    logSuccess(`Capped at max: ${result.previousValue} → ${result.value} (capped: ${result.capped})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterDecrement(ctx: TestContext): Promise<boolean> {
  logStep(4, 12, "Counter: Decrement");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/decrement",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME, step: 3 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { value: number; previousValue: number };
    if (result.previousValue !== 8) {
      logError(`Expected previousValue 8, got ${result.previousValue}`);
      return false;
    }
    if (result.value !== 5) {
      logError(`Expected value 5, got ${result.value}`);
      return false;
    }

    logSuccess(`Decremented: ${result.previousValue} → ${result.value}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterReset(ctx: TestContext): Promise<boolean> {
  logStep(5, 12, "Counter: Reset");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/reset",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME, resetTo: 100 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { value: number; previousValue: number };
    if (result.value !== 100) {
      logError(`Expected value 100, got ${result.value}`);
      return false;
    }

    logSuccess(`Reset: ${result.previousValue} → ${result.value}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterList(ctx: TestContext): Promise<boolean> {
  logStep(6, 12, "Counter: List all");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/list",
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { counters: Array<{ name: string; value: number }>; count: number };
    const ourCounter = result.counters.find((c) => c.name === TEST_COUNTER_NAME);

    if (!ourCounter) {
      logError(`Our counter not found in list of ${result.count}`);
      return false;
    }

    logSuccess(`Listed ${result.count} counter(s), found ours with value ${ourCounter.value}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterDelete(ctx: TestContext): Promise<boolean> {
  logStep(7, 12, "Counter: Delete");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/delete",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { deleted: boolean; name: string };
    if (!result.deleted) {
      logError(`Expected deleted=true`);
      return false;
    }

    logSuccess(`Deleted counter: ${result.name}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

// =============================================================================
// SQL Tests
// =============================================================================

async function testSqlSchemaInitial(ctx: TestContext): Promise<boolean> {
  logStep(8, 12, "SQL: Get initial schema");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/schema",
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { tables: Array<{ name: string; sql: string }> };
    const hasCounters = result.tables.some((t) => t.name === "counters");
    const hasUserData = result.tables.some((t) => t.name === "user_data");

    if (!hasCounters || !hasUserData) {
      logError(`Expected counters and user_data tables`);
      return false;
    }

    logSuccess(`Schema has ${result.tables.length} tables (counters, user_data)`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSqlCreateTable(ctx: TestContext): Promise<boolean> {
  logStep(9, 12, "SQL: Create custom table");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/execute",
      "POST",
      ctx.x402Client,
      {
        query: `CREATE TABLE IF NOT EXISTS ${TEST_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          score INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { success: boolean; rowsAffected: number };
    if (!result.success) {
      logError(`Expected success=true`);
      return false;
    }

    logSuccess(`Created table: ${TEST_TABLE_NAME}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSqlInsertData(ctx: TestContext): Promise<boolean> {
  logStep(10, 12, "SQL: Insert data");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/execute",
      "POST",
      ctx.x402Client,
      {
        query: `INSERT INTO ${TEST_TABLE_NAME} (name, score) VALUES (?, ?), (?, ?), (?, ?)`,
        params: ["Alice", 100, "Bob", 85, "Charlie", 92],
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { success: boolean; rowsAffected: number };
    if (result.rowsAffected !== 3) {
      logError(`Expected 3 rows affected, got ${result.rowsAffected}`);
      return false;
    }

    logSuccess(`Inserted ${result.rowsAffected} rows`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSqlQueryData(ctx: TestContext): Promise<boolean> {
  logStep(11, 12, "SQL: Query data");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/query",
      "POST",
      ctx.x402Client,
      {
        query: `SELECT name, score FROM ${TEST_TABLE_NAME} ORDER BY score DESC`,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { rows: Array<{ name: string; score: number }>; rowCount: number; columns: string[] };
    if (result.rowCount !== 3) {
      logError(`Expected 3 rows, got ${result.rowCount}`);
      return false;
    }

    // Check ordering (highest score first)
    if (result.rows[0].name !== "Alice" || result.rows[0].score !== 100) {
      logError(`Expected Alice with 100 first, got ${result.rows[0].name} with ${result.rows[0].score}`);
      return false;
    }

    logSuccess(`Queried ${result.rowCount} rows: ${result.rows.map((r) => `${r.name}(${r.score})`).join(", ")}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSqlSchemaFinal(ctx: TestContext): Promise<boolean> {
  logStep(12, 12, "SQL: Verify custom table in schema");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/schema",
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { tables: Array<{ name: string; sql: string }> };
    const customTable = result.tables.find((t) => t.name === TEST_TABLE_NAME);

    if (!customTable) {
      logError(`Custom table ${TEST_TABLE_NAME} not found in schema`);
      return false;
    }

    logSuccess(`Schema now has ${result.tables.length} tables (including ${TEST_TABLE_NAME})`);
    log("Table SQL:", customTable.sql);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.clear();
  console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  DURABLE OBJECTS LIFECYCLE TEST (Counter + SQL)${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);

  if (!X402_CLIENT_PK) {
    console.error(`${COLORS.red}Error: Set X402_CLIENT_PK env var${COLORS.reset}`);
    process.exit(1);
  }

  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    console.error(`${COLORS.red}Error: Invalid X402_NETWORK${COLORS.reset}`);
    process.exit(1);
  }

  const network: NetworkType = X402_NETWORK;

  // Initialize wallet
  const { address, key } = await deriveChildAccount(network, X402_CLIENT_PK, 0);

  const x402Client = new X402PaymentClient({
    network,
    privateKey: key,
  });

  console.log(`  Account:  ${address}`);
  console.log(`  Network:  ${network}`);
  console.log(`  Server:   ${X402_WORKER_URL}`);
  console.log(`  Token:    ${TOKEN_TYPE}`);
  console.log(`  Counter:  ${TEST_COUNTER_NAME}`);
  console.log(`  Table:    ${TEST_TABLE_NAME}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address,
    network,
  };

  const results: Array<{ name: string; passed: boolean }> = [];

  // Counter tests
  results.push({ name: "Counter: Increment", passed: await testCounterIncrement(ctx) });
  await sleep(300);

  results.push({ name: "Counter: Get", passed: await testCounterGet(ctx) });
  await sleep(300);

  results.push({ name: "Counter: Increment with bounds", passed: await testCounterIncrementWithBounds(ctx) });
  await sleep(300);

  results.push({ name: "Counter: Decrement", passed: await testCounterDecrement(ctx) });
  await sleep(300);

  results.push({ name: "Counter: Reset", passed: await testCounterReset(ctx) });
  await sleep(300);

  results.push({ name: "Counter: List", passed: await testCounterList(ctx) });
  await sleep(300);

  results.push({ name: "Counter: Delete", passed: await testCounterDelete(ctx) });
  await sleep(300);

  // SQL tests
  results.push({ name: "SQL: Schema (initial)", passed: await testSqlSchemaInitial(ctx) });
  await sleep(300);

  results.push({ name: "SQL: Create table", passed: await testSqlCreateTable(ctx) });
  await sleep(300);

  results.push({ name: "SQL: Insert data", passed: await testSqlInsertData(ctx) });
  await sleep(300);

  results.push({ name: "SQL: Query data", passed: await testSqlQueryData(ctx) });
  await sleep(300);

  results.push({ name: "SQL: Schema (final)", passed: await testSqlSchemaFinal(ctx) });

  // Summary
  console.log(`\n${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  RESULTS${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}`);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  for (const r of results) {
    const icon = r.passed ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset}`;
    console.log(`  ${icon} ${r.name}`);
  }

  console.log(`\n  ${passed}/${total} tests passed`);
  console.log(`${COLORS.bright}${"═".repeat(70)}${COLORS.reset}\n`);

  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
  process.exit(1);
});
