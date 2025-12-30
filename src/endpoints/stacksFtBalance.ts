import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { getNetworkFromPrincipal } from "../utils/network";
import { hiroFetch, getHiroApiUrl, isHiroRateLimitError } from "../utils/hiro";

interface FtBalance {
  balance: string;
  total_sent: string;
  total_received: string;
}

interface FtBalanceResponse {
  stx: { balance: string };
  fungible_tokens: Record<string, FtBalance>;
}

export class StacksFtBalance extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Get SIP-010 fungible token balances for an address",
    parameters: [
      {
        name: "address",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Stacks address",
      },
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "Fungible token balances",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                address: { type: "string" as const },
                tokens: { type: "array" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid address" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const address = c.req.param("address");

    let network: string;
    try {
      network = getNetworkFromPrincipal(address);
    } catch {
      return this.errorResponse(c, "Invalid Stacks address", 400);
    }

    const apiUrl = getHiroApiUrl(network as "mainnet" | "testnet");

    try {
      const response = await hiroFetch(`${apiUrl}/extended/v1/address/${address}/balances`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return this.errorResponse(c, `API error: ${response.status}`, 500);
      }

      const data = await response.json() as FtBalanceResponse;

      // Parse fungible tokens into a cleaner format
      const tokens = Object.entries(data.fungible_tokens || {}).map(([contractId, balance]) => {
        const [contractAddress, assetName] = contractId.split("::");
        return {
          contractId: contractAddress,
          assetName: assetName || "unknown",
          balance: balance.balance,
          totalSent: balance.total_sent,
          totalReceived: balance.total_received,
        };
      });

      return c.json({
        address,
        stxBalance: data.stx?.balance || "0",
        tokens,
        tokenCount: tokens.length,
        network,
        tokenType,
      });
    } catch (error) {
      if (isHiroRateLimitError(error)) {
        c.header("Retry-After", String(error.rateLimitError.retryAfter));
        return c.json({
          error: error.rateLimitError.error,
          code: error.rateLimitError.code,
          retryAfter: error.rateLimitError.retryAfter,
          tokenType,
        }, 503);
      }
      return this.errorResponse(c, `Failed to fetch balances: ${String(error)}`, 500);
    }
  }
}
