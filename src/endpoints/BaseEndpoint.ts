import { OpenAPIRoute } from "chanfana";
import { Address, deserializeTransaction } from "@stacks/transactions";
import { validateTokenType } from "../utils/pricing";
import type { AppContext, ExtendedSettleResult } from "../types";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { ERC8004_CONTRACTS, type ERC8004Network } from "../utils/erc8004";

export class BaseEndpoint extends OpenAPIRoute {
  /**
   * Get the network from query parameter with consistent default
   */
  protected getNetwork(c: AppContext): ERC8004Network {
    return (c.req.query("network") || "testnet") as ERC8004Network;
  }

  /**
   * Check if mainnet contracts are deployed. Returns an error response if not.
   * Returns null if the check passes (mainnet is deployed or using testnet).
   */
  protected checkMainnetDeployment(
    c: AppContext,
    network: ERC8004Network
  ): Response | null {
    if (network === "mainnet" && !ERC8004_CONTRACTS.mainnet) {
      return this.errorResponse(
        c,
        "ERC-8004 contracts not yet deployed on mainnet",
        501
      );
    }
    return null;
  }

  /**
   * Parse JSON request body with standardized error handling.
   * Returns the parsed body or an error response.
   */
  protected async parseJsonBody<T>(
    c: AppContext
  ): Promise<{ body: T; error?: never } | { body?: never; error: Response }> {
    try {
      const body = (await c.req.json()) as T;
      return { body };
    } catch {
      return { error: this.errorResponse(c, "Invalid JSON body", 400) };
    }
  }

  /**
   * Validate an agent ID value. Returns an error response if invalid.
   */
  protected validateAgentId(
    c: AppContext,
    agentId: number | undefined,
    source: "query" | "body" = "body"
  ): Response | null {
    if (agentId === undefined || agentId < 0) {
      const message =
        source === "query"
          ? "agentId query parameter is required and must be >= 0"
          : "agentId is required and must be >= 0";
      return this.errorResponse(c, message, 400);
    }
    return null;
  }

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
      c.var.logger.warn("Invalid address format", { address, error: String(e) });
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
        c.var.logger.warn("Failed to extract sender from signed tx", { error: String(error) });
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
