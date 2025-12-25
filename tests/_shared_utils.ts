import type { NetworkType, TokenType } from "x402-stacks";

export const X402_CLIENT_PK = process.env.X402_CLIENT_PK;
export const X402_NETWORK = (process.env.X402_NETWORK || "testnet") as NetworkType;

// "https://stx402.chaos.workers.dev";
export const X402_WORKER_URL = "http://localhost:8787";

export const TEST_TOKENS: TokenType[] = ["STX", "sBTC", "USDCx"];

export interface TestLogger {
  info: (msg: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  summary: (successCount: number, total: number) => void;
}

export function createTestLogger(testName: string): TestLogger {
  return {
    info: (msg) => console.log(`ℹ️ [${testName}] ${msg}`),
    success: (msg) => console.log(`✅ [${testName}] ${msg}`),
    error: (msg) => console.log(`❌ [${testName}] ${msg}`),
    summary: (successCount, total) => console.log(`📊 [${testName}] ${successCount}/${total} succeeded`),
  };
}
