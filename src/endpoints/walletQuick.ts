import { BaseEndpoint } from "./BaseEndpoint";
import { getNameFromAddress } from "../utils/bns";
import { getNetworkFromPrincipal } from "../utils/network";
import { hiroFetch, getHiroApiUrl, isHiroRateLimitError } from "../utils/hiro";
import type { AppContext } from "../types";

interface AccountBalance {
  stx: {
    balance: string;
    locked: string;
  };
  fungible_tokens: Record<string, { balance: string }>;
  non_fungible_tokens: Record<string, { count: number }>;
}

interface StxPriceResponse {
  stacks?: { usd?: number };
}

export class WalletQuick extends BaseEndpoint {
  schema = {
    tags: ["Wallet"],
    summary: "(paid) Fast portfolio summary - STX value, top holdings, BNS",
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
        description: "Quick portfolio summary",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                address: { type: "string" as const },
                bnsName: { type: "string" as const, nullable: true },
                stx: {
                  type: "object" as const,
                  properties: {
                    balance: { type: "string" as const },
                    usdValue: { type: "number" as const },
                    locked: { type: "string" as const },
                  },
                },
                topHoldings: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      name: { type: "string" as const },
                      balance: { type: "string" as const },
                    },
                  },
                },
                counts: {
                  type: "object" as const,
                  properties: {
                    tokens: { type: "integer" as const },
                    nfts: { type: "integer" as const },
                  },
                },
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

    if (!address) {
      return this.errorResponse(c, "address parameter is required", 400);
    }

    let network: "mainnet" | "testnet";
    try {
      network = getNetworkFromPrincipal(address) as "mainnet" | "testnet";
    } catch {
      return this.errorResponse(c, "Invalid Stacks address", 400);
    }

    const apiUrl = getHiroApiUrl(network);

    try {
      // Fetch all data in parallel
      const [bnsName, balanceResponse, stxPriceResponse] = await Promise.all([
        getNameFromAddress(address).catch(() => null),
        hiroFetch(`${apiUrl}/extended/v1/address/${address}/balances`, {
          headers: { Accept: "application/json" },
        }),
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=stacks&vs_currencies=usd", {
          headers: { Accept: "application/json" },
        }).catch(() => null),
      ]);

      if (!balanceResponse.ok) {
        return this.errorResponse(c, "Failed to fetch balances", 500);
      }

      const balanceData = (await balanceResponse.json()) as AccountBalance;

      // Parse STX price
      let stxPrice = 0;
      if (stxPriceResponse?.ok) {
        const priceData = (await stxPriceResponse.json()) as StxPriceResponse;
        stxPrice = priceData.stacks?.usd || 0;
      }

      // Calculate STX values
      const stxMicro = BigInt(balanceData.stx?.balance || "0");
      const stxBalance = Number(stxMicro) / 1_000_000;
      const stxUsdValue = stxBalance * stxPrice;
      const stxLocked = BigInt(balanceData.stx?.locked || "0");

      // Get top 5 holdings by balance (simple heuristic - highest raw balance)
      const topHoldings: { name: string; balance: string }[] = [];
      if (balanceData.fungible_tokens) {
        const sorted = Object.entries(balanceData.fungible_tokens)
          .map(([contractId, data]) => {
            const [, assetName] = contractId.split("::");
            const name = assetName || contractId.split(".").pop() || "unknown";
            return { name, balance: data.balance, balanceNum: BigInt(data.balance) };
          })
          .sort((a, b) => (b.balanceNum > a.balanceNum ? 1 : -1))
          .slice(0, 5);

        for (const h of sorted) {
          topHoldings.push({ name: h.name, balance: h.balance });
        }
      }

      // Count NFTs
      const nftCount = balanceData.non_fungible_tokens
        ? Object.values(balanceData.non_fungible_tokens).reduce(
            (sum, data) => sum + (data.count || 0),
            0
          )
        : 0;

      const tokenCount = balanceData.fungible_tokens
        ? Object.keys(balanceData.fungible_tokens).length
        : 0;

      return c.json({
        address,
        bnsName,
        stx: {
          balance: stxBalance.toFixed(6),
          usdValue: Math.round(stxUsdValue * 100) / 100,
          locked: (Number(stxLocked) / 1_000_000).toFixed(6),
        },
        topHoldings,
        counts: {
          tokens: tokenCount,
          nfts: nftCount,
        },
        tokenType,
      });
    } catch (error) {
      if (isHiroRateLimitError(error)) {
        c.header("Retry-After", String(error.rateLimitError.retryAfter));
        return c.json(
          {
            error: error.rateLimitError.error,
            code: error.rateLimitError.code,
            retryAfter: error.rateLimitError.retryAfter,
            tokenType,
          },
          503
        );
      }
      return this.errorResponse(c, `Failed to fetch wallet: ${String(error)}`, 500);
    }
  }
}
