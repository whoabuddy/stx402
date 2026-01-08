import { BaseEndpoint } from "./BaseEndpoint";
import { getNetworkFromPrincipal } from "../utils/network";
import { hiroFetch, getHiroApiUrl, isHiroRateLimitError } from "../utils/hiro";
import type { AppContext } from "../types";

// sBTC contract addresses
const SBTC_TOKEN = {
  mainnet: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
  testnet: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token",
};

// Known yield protocols
const YIELD_PROTOCOLS = {
  stackingdao: {
    name: "StackingDAO",
    type: "liquid-stacking",
    baseApy: 5.0,
    riskLevel: "low",
    riskFactors: ["smart-contract"],
  },
  zest: {
    name: "Zest Protocol",
    type: "lending",
    baseApy: 8.0,
    riskLevel: "medium",
    riskFactors: ["smart-contract", "utilization-rate"],
  },
  alex: {
    name: "ALEX",
    type: "amm",
    baseApy: 12.0,
    riskLevel: "medium",
    riskFactors: ["smart-contract", "impermanent-loss"],
  },
  velar: {
    name: "Velar",
    type: "amm",
    baseApy: 15.0,
    riskLevel: "medium-high",
    riskFactors: ["smart-contract", "impermanent-loss", "newer-protocol"],
  },
};

interface AccountBalance {
  stx: { balance: string };
  fungible_tokens: Record<string, { balance: string }>;
}

export class SbtcTreasury extends BaseEndpoint {
  schema = {
    tags: ["sBTC"],
    summary: "(paid) sBTC treasury intelligence for AI agents - holdings, yield opportunities, health score",
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
        description: "sBTC treasury intelligence report",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                address: { type: "string" as const },
                network: { type: "string" as const },
                holdings: {
                  type: "object" as const,
                  properties: {
                    sbtcBalance: { type: "string" as const },
                    sbtcFormatted: { type: "string" as const },
                    stxBalance: { type: "string" as const },
                    stxFormatted: { type: "string" as const },
                    hasSufficientFees: { type: "boolean" as const },
                  },
                },
                yieldOpportunities: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      protocol: { type: "string" as const },
                      type: { type: "string" as const },
                      estimatedApy: { type: "number" as const },
                      riskLevel: { type: "string" as const },
                      riskFactors: { type: "array" as const, items: { type: "string" as const } },
                    },
                  },
                },
                healthScore: {
                  type: "object" as const,
                  properties: {
                    score: { type: "integer" as const },
                    level: { type: "string" as const },
                    factors: {
                      type: "object" as const,
                      properties: {
                        hasSbtc: { type: "boolean" as const },
                        hasFeeFunds: { type: "boolean" as const },
                        diversified: { type: "boolean" as const },
                      },
                    },
                  },
                },
                recommendations: {
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
    const sbtcContract = SBTC_TOKEN[network];

    try {
      // Fetch balances
      const balanceResponse = await hiroFetch(
        `${apiUrl}/extended/v1/address/${address}/balances`,
        { headers: { Accept: "application/json" } }
      );

      if (!balanceResponse.ok) {
        return this.errorResponse(c, "Failed to fetch balances", 500);
      }

      const balanceData = (await balanceResponse.json()) as AccountBalance;

      // Parse STX balance
      const stxMicro = BigInt(balanceData.stx?.balance || "0");
      const stxFormatted = (Number(stxMicro) / 1_000_000).toFixed(6);

      // Parse sBTC balance
      let sbtcBalance = "0";
      let sbtcFormatted = "0.00000000";

      if (balanceData.fungible_tokens) {
        const sbtcKey = Object.keys(balanceData.fungible_tokens).find((key) =>
          key.toLowerCase().includes("sbtc")
        );
        if (sbtcKey) {
          sbtcBalance = balanceData.fungible_tokens[sbtcKey].balance;
          // sBTC has 8 decimals
          sbtcFormatted = (Number(BigInt(sbtcBalance)) / 100_000_000).toFixed(8);
        }
      }

      // Check if has sufficient fees (at least 1 STX for transactions)
      const hasSufficientFees = Number(stxMicro) >= 1_000_000;

      // Build yield opportunities
      const yieldOpportunities = Object.entries(YIELD_PROTOCOLS).map(
        ([key, protocol]) => ({
          protocol: protocol.name,
          type: protocol.type,
          estimatedApy: protocol.baseApy,
          riskLevel: protocol.riskLevel,
          riskFactors: protocol.riskFactors,
        })
      );

      // Sort by APY descending
      yieldOpportunities.sort((a, b) => b.estimatedApy - a.estimatedApy);

      // Calculate health score
      const hasSbtc = BigInt(sbtcBalance) > 0n;
      const hasFeeFunds = hasSufficientFees;
      const diversified = true; // Would need position tracking for real check

      let healthScore = 0;
      if (hasSbtc) healthScore += 40;
      if (hasFeeFunds) healthScore += 30;
      if (diversified) healthScore += 30;

      const healthLevel =
        healthScore >= 80 ? "excellent" : healthScore >= 60 ? "good" : healthScore >= 40 ? "fair" : "needs-attention";

      // Generate recommendations
      const recommendations: string[] = [];

      if (!hasSbtc) {
        recommendations.push("Acquire sBTC to start earning yield");
      } else if (BigInt(sbtcBalance) > 0n) {
        recommendations.push(
          `Deploy idle sBTC to ${yieldOpportunities[0].protocol} for ~${yieldOpportunities[0].estimatedApy}% APY`
        );
      }

      if (!hasFeeFunds) {
        recommendations.push("Add STX for transaction fees (recommend 2+ STX)");
      }

      if (hasSbtc && hasFeeFunds) {
        recommendations.push("Consider diversifying across multiple protocols to reduce risk");
        recommendations.push(
          `Low-risk option: ${YIELD_PROTOCOLS.stackingdao.name} at ~${YIELD_PROTOCOLS.stackingdao.baseApy}% APY`
        );
      }

      return c.json({
        address,
        network,
        holdings: {
          sbtcBalance,
          sbtcFormatted,
          stxBalance: stxMicro.toString(),
          stxFormatted,
          hasSufficientFees,
        },
        yieldOpportunities,
        healthScore: {
          score: healthScore,
          level: healthLevel,
          factors: {
            hasSbtc,
            hasFeeFunds,
            diversified,
          },
        },
        recommendations,
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
      return this.errorResponse(c, `Failed to analyze treasury: ${String(error)}`, 500);
    }
  }
}
