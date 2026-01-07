import { OpenAPIRoute } from "chanfana";
import { Address, deserializeTransaction } from "@stacks/transactions";
import { validateTokenType } from "../utils/pricing";
import type { AppContext } from "../types";
import { ContentfulStatusCode } from "hono/utils/http-status";
import type { SettlePaymentResult } from "../middleware/x402-stacks";
import { log } from "../utils/logger";

// Extended settle result that may have sender in different formats
interface ExtendedSettleResult extends SettlePaymentResult {
  senderAddress?: string;
  sender_address?: string;
}

export class BaseEndpoint extends OpenAPIRoute {
  protected getTokenType(c: AppContext): string {
    const rawTokenType = c.req.query("tokenType") || "STX";
    return validateTokenType(rawTokenType);
  }

  protected validateAddress(c: AppContext): string | null {
    const address = c.req.param("address");
    try {
      const addressObj = Address.parse(address);
      return Address.stringify(addressObj);
    } catch (e) {
      log.warn("Invalid address format", { address, error: String(e) });
      return null;
    }
  }

  /**
   * Get the payer's address from the payment settlement result or signed transaction
   * This is set by the x402 middleware after successful payment verification
   */
  protected getPayerAddress(c: AppContext): string | null {
    const settleResult = c.get("settleResult") as ExtendedSettleResult | undefined;
    const signedTx = c.get("signedTx") as string | undefined;
    const network = c.env?.X402_NETWORK as "mainnet" | "testnet" || "mainnet";

    // Try various fields from settle result first
    if (settleResult?.sender) {
      return settleResult.sender;
    }
    if (settleResult?.senderAddress) {
      return settleResult.senderAddress;
    }
    if (settleResult?.sender_address) {
      return settleResult.sender_address;
    }

    // Fallback: extract sender from signed transaction
    if (signedTx) {
      try {
        const hex = signedTx.startsWith("0x") ? signedTx.slice(2) : signedTx;
        const tx = deserializeTransaction(hex);

        if (tx.auth?.spendingCondition) {
          const spendingCondition = tx.auth.spendingCondition as {
            signer?: string;
            hashMode?: number;
          };

          if (spendingCondition.signer) {
            // Convert hash160 to address using the appropriate network
            const hash160 = spendingCondition.signer;
            const addressVersion = network === "mainnet" ? 22 : 26; // P2PKH versions
            const address = Address.stringify({ hash160, type: addressVersion });
            return address;
          }
        }
      } catch (error) {
        log.warn("Failed to extract sender from signed tx", { error: String(error) });
      }
    }

    return null;
  }

  protected errorResponse(
    c: AppContext,
    error: string,
    status: ContentfulStatusCode,
    extra: Record<string, unknown> = {}
  ): Response {
    const tokenType = this.getTokenType(c);
    return c.json({ tokenType, error, ...extra }, status);
  }
}
