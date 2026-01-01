import {
  deserializeTransaction,
  Address,
} from "@stacks/transactions";

// Extended settle result that includes sender address
export interface ExtendedSettleResult {
  isValid: boolean;
  txId?: string;
  status?: string;
  blockHeight?: number;
  error?: string;
  reason?: string;
  senderAddress?: string;
  sender_address?: string; // Facilitator might use snake_case
  recipientAddress?: string;
  recipient_address?: string;
  amount?: string | number;
}

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
    console.error("Failed to extract sender hash160 from signed tx:", error);
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

// Parse the X-PAYMENT-RESPONSE header to get payment details
export function parsePaymentResponse(headerValue: string | null): ExtendedSettleResult | null {
  if (!headerValue) return null;

  try {
    const result = JSON.parse(headerValue) as ExtendedSettleResult;

    // Normalize snake_case to camelCase for easier access
    if (result.sender_address && !result.senderAddress) {
      result.senderAddress = result.sender_address;
    }
    if (result.recipient_address && !result.recipientAddress) {
      result.recipientAddress = result.recipient_address;
    }

    return result;
  } catch {
    return null;
  }
}

// Check if the payer (from settle result or signed tx) matches an expected address
export function payerMatchesAddress(
  settleResult: ExtendedSettleResult | null,
  signedTxHex: string | null,
  expectedAddress: string
): boolean {
  // First, try to match from settle result (preferred - from facilitator)
  if (settleResult?.senderAddress) {
    if (addressesMatchByHash160(settleResult.senderAddress, expectedAddress)) {
      return true;
    }
  }
  if (settleResult?.sender_address) {
    if (addressesMatchByHash160(settleResult.sender_address, expectedAddress)) {
      return true;
    }
  }

  // Fallback: check signed transaction directly
  if (signedTxHex) {
    return txSenderMatchesAddress(signedTxHex, expectedAddress);
  }

  return false;
}
