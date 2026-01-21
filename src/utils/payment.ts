import {
  deserializeTransaction,
  Address,
} from "@stacks/transactions";
import { log } from "./logger";
import type { SettlementResponseV2 } from "../types";

// Extract sender hash160 from a signed transaction hex
// Returns the hash160 directly, avoiding network version issues
export function extractSenderHash160FromSignedTx(signedTxHex: string): string | null {
  try {
    // Remove 0x prefix if present
    const hex = signedTxHex.startsWith("0x") ? signedTxHex.slice(2) : signedTxHex;

    // Deserialize the transaction
    const tx = deserializeTransaction(hex);

    // Get the signer hash160 from the spending condition
    if (tx.auth && tx.auth.spendingCondition) {
      const spendingCondition = tx.auth.spendingCondition as {
        signer?: string;
        hashMode?: number;
      };

      if (spendingCondition.signer) {
        return spendingCondition.signer;
      }
    }

    return null;
  } catch (error) {
    log.warn("Failed to extract sender hash160 from signed tx", { error: String(error) });
    return null;
  }
}

// Extract hash160 from a Stacks address string
export function extractHash160FromAddress(address: string): string | null {
  try {
    const parsed = Address.parse(address);
    return parsed.hash160;
  } catch {
    return null;
  }
}

// Compare two addresses by their hash160 (ignores network version)
// This handles comparing SP... with ST... addresses from the same key
export function addressesMatchByHash160(addr1: string | null, addr2: string | null): boolean {
  if (!addr1 || !addr2) return false;

  const hash1 = extractHash160FromAddress(addr1);
  const hash2 = extractHash160FromAddress(addr2);

  if (!hash1 || !hash2) return false;

  return hash1.toLowerCase() === hash2.toLowerCase();
}

// Check if a signed transaction's sender matches an address (by hash160)
export function txSenderMatchesAddress(signedTxHex: string, address: string): boolean {
  const txHash160 = extractSenderHash160FromSignedTx(signedTxHex);
  const addrHash160 = extractHash160FromAddress(address);

  if (!txHash160 || !addrHash160) return false;

  return txHash160.toLowerCase() === addrHash160.toLowerCase();
}

// Check if the payer (from V2 settle result or signed tx) matches an expected address
export function payerMatchesAddress(
  settleResult: SettlementResponseV2 | null,
  signedTxHex: string | null,
  expectedAddress: string
): boolean {
  // V2: Use 'payer' field from settlement result (preferred - from facilitator)
  if (settleResult?.payer) {
    if (addressesMatchByHash160(settleResult.payer, expectedAddress)) {
      return true;
    }
  }

  // Fallback: check signed transaction directly
  if (signedTxHex) {
    return txSenderMatchesAddress(signedTxHex, expectedAddress);
  }

  return false;
}
