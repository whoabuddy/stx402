import { BaseEndpoint } from "./BaseEndpoint";
import { getNameFromAddress } from "../utils/bns";
import { getNetworkFromPrincipal } from "../utils/network";
import { hiroFetch, getHiroApiUrl, isHiroRateLimitError } from "../utils/hiro";
import type { AppContext } from "../types";

// Known protocol contracts for DeFi detection
const DEFI_PROTOCOLS: Record<string, { name: string; type: string }> = {
  "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex": { name: "ALEX", type: "dex" },
  "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.velar": { name: "Velar", type: "dex" },
  "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko": { name: "Arkadiko", type: "cdp" },
  "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao": { name: "StackingDAO", type: "liquid-staking" },
};

// Blue-chip tokens on Stacks
const BLUE_CHIP_TOKENS = [
  "sbtc", "stx", "alex", "velar", "usda", "xusd", "ststx", "liststx",
];

// Known meme tokens
const MEME_TOKENS = [
  "welsh", "roo", "leo", "not", "pepe", "dog", "cat",
];

interface AccountBalance {
  stx: {
    balance: string;
    total_sent: string;
    total_received: string;
    locked: string;
  };
  fungible_tokens: Record<string, { balance: string }>;
  non_fungible_tokens: Record<string, { count: number }>;
}

interface TokenHolding {
  contract: string;
  name: string;
  balance: string;
  category: "blue-chip" | "meme" | "other";
}

interface StxPriceResponse {
  stacks?: { usd?: number };
}

export class WalletAnalyze extends BaseEndpoint {
  schema = {
    tags: ["Wallet"],
    summary: "(paid) Full wallet intelligence - USD values, risk score, DeFi detection, insights",
    parameters: [
      {
        name: "address",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Stacks address to analyze",
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
        description: "Wallet intelligence report",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                address: { type: "string" as const },
                network: { type: "string" as const },
                bnsName: { type: "string" as const, nullable: true },
                portfolio: {
                  type: "object" as const,
                  properties: {
                    stxBalance: { type: "string" as const },
                    stxUsdValue: { type: "number" as const },
                    totalTokens: { type: "integer" as const },
                    nftCount: { type: "integer" as const },
                  },
                },
                holdings: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      contract: { type: "string" as const },
                      name: { type: "string" as const },
                      balance: { type: "string" as const },
                      category: { type: "string" as const },
                    },
                  },
                },
                defiExposure: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      protocol: { type: "string" as const },
                      type: { type: "string" as const },
                    },
                  },
                },
                riskScore: {
                  type: "object" as const,
                  properties: {
                    score: { type: "integer" as const },
                    level: { type: "string" as const },
                    factors: {
                      type: "object" as const,
                      properties: {
                        diversification: { type: "string" as const },
                        memeExposure: { type: "string" as const },
                        defiExposure: { type: "string" as const },
                      },
                    },
                  },
                },
                insights: {
                  type: "array" as const,
                  items: { type: "string" as const },
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

      // Parse token holdings with categorization
      const holdings: TokenHolding[] = [];
      let memeCount = 0;
      let blueChipCount = 0;

      if (balanceData.fungible_tokens) {
        for (const [contractId, data] of Object.entries(balanceData.fungible_tokens)) {
          const [contract, assetName] = contractId.split("::");
          const name = assetName || contract.split(".").pop() || "unknown";
          const nameLower = name.toLowerCase();

          let category: "blue-chip" | "meme" | "other" = "other";
          if (BLUE_CHIP_TOKENS.some((t) => nameLower.includes(t))) {
            category = "blue-chip";
            blueChipCount++;
          } else if (MEME_TOKENS.some((t) => nameLower.includes(t))) {
            category = "meme";
            memeCount++;
          }

          holdings.push({
            contract,
            name,
            balance: data.balance,
            category,
          });
        }
      }

      // Count NFTs
      const nftCount = balanceData.non_fungible_tokens
        ? Object.values(balanceData.non_fungible_tokens).reduce(
            (sum, data) => sum + (data.count || 0),
            0
          )
        : 0;

      // Detect DeFi exposure
      const defiExposure: { protocol: string; type: string }[] = [];
      for (const holding of holdings) {
        for (const [prefix, info] of Object.entries(DEFI_PROTOCOLS)) {
          if (holding.contract.startsWith(prefix.split(".")[0])) {
            if (!defiExposure.some((d) => d.protocol === info.name)) {
              defiExposure.push({ protocol: info.name, type: info.type });
            }
          }
        }
      }

      // Calculate risk score (0-100, lower is safer)
      const totalTokens = holdings.length;
      const memeRatio = totalTokens > 0 ? memeCount / totalTokens : 0;
      const defiCount = defiExposure.length;

      let riskScore = 20; // Base score

      // Diversification factor
      if (totalTokens === 0) {
        riskScore += 0; // STX only = low risk
      } else if (totalTokens <= 3) {
        riskScore += 10; // Concentrated
      } else if (totalTokens <= 10) {
        riskScore += 5; // Moderate diversification
      }

      // Meme exposure
      if (memeRatio > 0.5) {
        riskScore += 40; // High meme exposure
      } else if (memeRatio > 0.2) {
        riskScore += 20; // Moderate meme exposure
      } else if (memeRatio > 0) {
        riskScore += 10; // Low meme exposure
      }

      // DeFi complexity
      if (defiCount >= 3) {
        riskScore += 15; // Complex DeFi exposure
      } else if (defiCount > 0) {
        riskScore += 5; // Some DeFi exposure
      }

      riskScore = Math.min(100, riskScore);

      const riskLevel =
        riskScore >= 70 ? "high" : riskScore >= 40 ? "moderate" : "low";

      const riskFactors = {
        diversification:
          totalTokens === 0
            ? "stx-only"
            : totalTokens <= 3
            ? "concentrated"
            : "diversified",
        memeExposure:
          memeRatio > 0.5 ? "high" : memeRatio > 0 ? "moderate" : "none",
        defiExposure:
          defiCount >= 3 ? "complex" : defiCount > 0 ? "moderate" : "none",
      };

      // Generate insights
      const insights: string[] = [];

      if (stxBalance < 1) {
        insights.push("Low STX balance - may not have enough for transaction fees");
      }

      if (memeRatio > 0.5) {
        insights.push("Portfolio heavily weighted toward meme tokens - consider diversifying");
      }

      if (blueChipCount === 0 && totalTokens > 0) {
        insights.push("No blue-chip tokens detected - consider adding established assets");
      }

      if (defiCount > 0) {
        insights.push(
          `Active in ${defiCount} DeFi protocol${defiCount > 1 ? "s" : ""}: ${defiExposure.map((d) => d.protocol).join(", ")}`
        );
      }

      if (nftCount > 10) {
        insights.push(`NFT collector with ${nftCount} items across collections`);
      }

      if (insights.length === 0) {
        insights.push("Balanced portfolio with standard risk profile");
      }

      return c.json({
        address,
        network,
        bnsName,
        portfolio: {
          stxBalance: stxBalance.toFixed(6),
          stxUsdValue: Math.round(stxUsdValue * 100) / 100,
          totalTokens,
          nftCount,
        },
        holdings: holdings.slice(0, 20), // Top 20 holdings
        defiExposure,
        riskScore: {
          score: riskScore,
          level: riskLevel,
          factors: riskFactors,
        },
        insights,
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
      return this.errorResponse(c, `Failed to analyze wallet: ${String(error)}`, 500);
    }
  }
}
