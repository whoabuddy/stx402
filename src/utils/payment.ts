import {
  deserializeTransaction,
  Address,
} from "@stacks/transactions";
import { TransactionVersion } from "@stacks/network";

// Address version constants
const MAINNET_SINGLE_SIG = 22;
const TESTNET_SINGLE_SIG = 26;

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

// Extract sender address from a signed transaction hex
export function extractSenderFromSignedTx(signedTxHex: string): string | null {
  try {
    // Remove 0x prefix if present
    const hex = signedTxHex.startsWith("0x") ? signedTxHex.slice(2) : signedTxHex;

    // Deserialize the transaction
    const tx = deserializeTransaction(hex);

    // Get the sender address from the auth field
    // The sender is in the origin auth's address
    if (tx.auth && tx.auth.spendingCondition) {
      const spendingCondition = tx.auth.spendingCondition as {
        signer?: string;
        hashMode?: number;
      };

      // Get signer hash160 from the spending condition
      if (spendingCondition.signer) {
        const hash160 = spendingCondition.signer;

        // Get the address version from the transaction version
        // TransactionVersion.Mainnet = 0, TransactionVersion.Testnet = 128
        const isMainnet = tx.version === TransactionVersion.Mainnet;
        const addressVersion = isMainnet ? MAINNET_SINGLE_SIG : TESTNET_SINGLE_SIG;

        // Create address object and stringify
        const addressData = {
          version: addressVersion,
          hash160,
        };

        return Address.stringify(addressData as Address);
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to extract sender from signed tx:", error);
    return null;
  }
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

// Get payer address from either the settle result or the signed transaction
export function getPayerAddress(
  settleResult: ExtendedSettleResult | null,
  signedTxHex?: string
): string | null {
  // First, try to get from settle result (preferred - from facilitator)
  if (settleResult?.senderAddress) {
    return settleResult.senderAddress;
  }

  // Fallback: extract from signed transaction
  if (signedTxHex) {
    return extractSenderFromSignedTx(signedTxHex);
  }

  return null;
}

// Utility to get payer address from request context
export function getPayerFromContext(
  paymentResponseHeader: string | null,
  paymentHeader: string | null
): string | null {
  // Try from response header first (has facilitator data)
  const settleResult = parsePaymentResponse(paymentResponseHeader);
  if (settleResult?.senderAddress) {
    return settleResult.senderAddress;
  }

  // Fallback to extracting from the signed tx
  if (paymentHeader) {
    return extractSenderFromSignedTx(paymentHeader);
  }

  return null;
}
