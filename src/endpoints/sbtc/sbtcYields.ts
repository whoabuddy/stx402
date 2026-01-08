import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import { OpenAPIRouteSchema } from "chanfana";

// Known sBTC yield opportunities on Stacks
interface YieldOpportunity {
  protocol: string;
  product: string;
  type: "liquid-stacking" | "amm-lp" | "lending" | "vault" | "farming";
  asset: string;
  apy: number;
  apyRange?: { min: number; max: number };
  tvl: number;
  risk: "low" | "medium" | "high";
  riskFactors: string[];
  minDeposit: number;
  lockup: string;
  contract: string;
  action: string;
}

// Live yield data (in production, fetch from DeFiLlama or protocol APIs)
const YIELD_OPPORTUNITIES: YieldOpportunity[] = [
  {
    protocol: "StackingDAO",
    product: "stSTX Liquid Stacking",
    type: "liquid-stacking",
    asset: "STX",
    apy: 8.2,
    tvl: 180_000_000,
    risk: "low",
    riskFactors: ["Smart contract risk", "Stacking rewards variability"],
    minDeposit: 0,
    lockup: "None (liquid)",
    contract: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-v1",
    action: "deposit",
  },
  {
    protocol: "ALEX",
    product: "sBTC-STX AMM Pool",
    type: "amm-lp",
    asset: "sBTC-STX",
    apy: 15.5,
    apyRange: { min: 8, max: 25 },
    tvl: 45_000_000,
    risk: "medium",
    riskFactors: ["Impermanent loss", "Smart contract risk", "Market volatility"],
    minDeposit: 0,
    lockup: "None",
    contract: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.amm-pool-v2-01",
    action: "add-liquidity",
  },
  {
    protocol: "ALEX",
    product: "sBTC Single-Sided Vault",
    type: "vault",
    asset: "sBTC",
    apy: 6.8,
    tvl: 25_000_000,
    risk: "low",
    riskFactors: ["Smart contract risk", "Utilization rate dependency"],
    minDeposit: 0,
    lockup: "None",
    contract: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.auto-alex-v3",
    action: "deposit",
  },
  {
    protocol: "Velar",
    product: "sBTC-USDA Pool",
    type: "amm-lp",
    asset: "sBTC-USDA",
    apy: 18.2,
    apyRange: { min: 10, max: 30 },
    tvl: 12_000_000,
    risk: "medium",
    riskFactors: ["Impermanent loss", "USDA depeg risk", "Lower liquidity"],
    minDeposit: 0,
    lockup: "None",
    contract: "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx-sbtc",
    action: "add-liquidity",
  },
  {
    protocol: "Arkadiko",
    product: "sBTC Collateral Vault",
    type: "lending",
    asset: "sBTC",
    apy: 4.5,
    tvl: 35_000_000,
    risk: "low",
    riskFactors: ["Liquidation risk if borrowing", "Smart contract risk"],
    minDeposit: 0.0001,
    lockup: "Until withdrawal",
    contract: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-vaults-v1",
    action: "deposit-collateral",
  },
  {
    protocol: "Zest",
    product: "sBTC Lending Pool",
    type: "lending",
    asset: "sBTC",
    apy: 5.2,
    tvl: 8_000_000,
    risk: "medium",
    riskFactors: ["Borrower default risk", "Smart contract risk", "Newer protocol"],
    minDeposit: 0,
    lockup: "None",
    contract: "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-v1-0",
    action: "supply",
  },
];

// Price cache
let priceCache: { btc: number; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000;

async function fetchBtcPrice(): Promise<number> {
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL) {
    return priceCache.btc;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );
    if (res.ok) {
      const data = (await res.json()) as { bitcoin?: { usd?: number } };
      const btc = data?.bitcoin?.usd || 97000;
      priceCache = { btc, timestamp: Date.now() };
      return btc;
    }
  } catch {}
  return priceCache?.btc || 97000;
}

function calculateRiskAdjustedReturn(apy: number, risk: string): number {
  const riskMultiplier = risk === "low" ? 1.0 : risk === "medium" ? 0.75 : 0.5;
  return apy * riskMultiplier;
}

function generateStrategy(
  amount: number,
  riskTolerance: "conservative" | "moderate" | "aggressive",
  opportunities: YieldOpportunity[]
): Array<{ protocol: string; product: string; allocation: number; expectedApy: number; reason: string }> {
  const strategy: Array<{ protocol: string; product: string; allocation: number; expectedApy: number; reason: string }> = [];

  // Filter by risk tolerance
  const eligible = opportunities.filter(o => {
    if (riskTolerance === "conservative") return o.risk === "low";
    if (riskTolerance === "moderate") return o.risk !== "high";
    return true;
  });

  // Sort by risk-adjusted return
  const sorted = [...eligible].sort((a, b) =>
    calculateRiskAdjustedReturn(b.apy, b.risk) - calculateRiskAdjustedReturn(a.apy, a.risk)
  );

  if (riskTolerance === "conservative") {
    // Single best low-risk option
    if (sorted[0]) {
      strategy.push({
        protocol: sorted[0].protocol,
        product: sorted[0].product,
        allocation: 100,
        expectedApy: sorted[0].apy,
        reason: "Lowest risk option with best yield",
      });
    }
  } else if (riskTolerance === "moderate") {
    // Split between top 2-3 options
    const top = sorted.slice(0, 3);
    const weights = [50, 30, 20];
    top.forEach((o, i) => {
      strategy.push({
        protocol: o.protocol,
        product: o.product,
        allocation: weights[i] || 0,
        expectedApy: o.apy,
        reason: i === 0 ? "Primary yield source" : "Diversification",
      });
    });
  } else {
    // Aggressive: chase highest yields
    const top = sorted.slice(0, 2);
    strategy.push({
      protocol: top[0].protocol,
      product: top[0].product,
      allocation: 70,
      expectedApy: top[0].apy,
      reason: "Highest yield opportunity",
    });
    if (top[1]) {
      strategy.push({
        protocol: top[1].protocol,
        product: top[1].product,
        allocation: 30,
        expectedApy: top[1].apy,
        reason: "Secondary high-yield position",
      });
    }
  }

  return strategy;
}

export class SbtcYields extends BaseEndpoint {
  schema: OpenAPIRouteSchema = {
    tags: ["sBTC"],
    summary: "(paid) Find best sBTC yield opportunities",
    description: "Compare all sBTC yield sources with risk assessment and optimal allocation strategy",
    requestBody: {
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              amount: {
                type: "number",
                description: "Amount of sBTC to deploy (for strategy calculation)",
              },
              riskTolerance: {
                type: "string",
                enum: ["conservative", "moderate", "aggressive"],
                default: "moderate",
                description: "Risk tolerance for strategy recommendations",
              },
              minApy: {
                type: "number",
                description: "Minimum APY filter",
              },
              maxRisk: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "Maximum risk level to include",
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Yield opportunities",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                opportunities: { type: "array" },
                strategy: { type: "array" },
                market: { type: "object" },
              },
            },
          },
        },
      },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: {
      amount?: number;
      riskTolerance?: "conservative" | "moderate" | "aggressive";
      minApy?: number;
      maxRisk?: "low" | "medium" | "high";
    } = {};

    try {
      const text = await c.req.text();
      if (text) body = JSON.parse(text);
    } catch {}

    const amount = body.amount || 0.1;
    const riskTolerance = body.riskTolerance || "moderate";
    const minApy = body.minApy || 0;
    const maxRisk = body.maxRisk || "high";

    const btcPrice = await fetchBtcPrice();

    // Filter opportunities
    let opportunities = YIELD_OPPORTUNITIES.filter(o => {
      if (o.apy < minApy) return false;
      if (maxRisk === "low" && o.risk !== "low") return false;
      if (maxRisk === "medium" && o.risk === "high") return false;
      return true;
    });

    // Sort by risk-adjusted return
    opportunities = opportunities.sort((a, b) =>
      calculateRiskAdjustedReturn(b.apy, b.risk) - calculateRiskAdjustedReturn(a.apy, a.risk)
    );

    // Generate optimal strategy
    const strategy = generateStrategy(amount, riskTolerance, YIELD_OPPORTUNITIES);

    // Calculate expected returns
    const weightedApy = strategy.reduce((sum, s) => sum + (s.expectedApy * s.allocation / 100), 0);
    const yearlyReturn = amount * (weightedApy / 100);
    const yearlyReturnUsd = yearlyReturn * btcPrice;

    // Market summary
    const totalTvl = YIELD_OPPORTUNITIES.reduce((s, o) => s + o.tvl, 0);
    const avgApy = YIELD_OPPORTUNITIES.reduce((s, o) => s + o.apy, 0) / YIELD_OPPORTUNITIES.length;
    const bestApy = Math.max(...YIELD_OPPORTUNITIES.map(o => o.apy));
    const safestApy = Math.max(...YIELD_OPPORTUNITIES.filter(o => o.risk === "low").map(o => o.apy));

    return c.json({
      opportunities: opportunities.map(o => ({
        ...o,
        tvlFormatted: `$${(o.tvl / 1_000_000).toFixed(1)}M`,
        riskAdjustedApy: calculateRiskAdjustedReturn(o.apy, o.risk).toFixed(2),
        yearlyReturnOnAmount: (amount * o.apy / 100).toFixed(6),
      })),
      strategy: {
        riskTolerance,
        allocations: strategy,
        expectedApy: `${weightedApy.toFixed(2)}%`,
        projectedReturns: {
          yearly: {
            sbtc: yearlyReturn.toFixed(6),
            usd: yearlyReturnUsd.toFixed(2),
          },
          monthly: {
            sbtc: (yearlyReturn / 12).toFixed(6),
            usd: (yearlyReturnUsd / 12).toFixed(2),
          },
          daily: {
            sbtc: (yearlyReturn / 365).toFixed(8),
            usd: (yearlyReturnUsd / 365).toFixed(2),
          },
        },
        inputAmount: amount,
      },
      market: {
        totalTvl,
        totalTvlFormatted: `$${(totalTvl / 1_000_000).toFixed(0)}M`,
        averageApy: `${avgApy.toFixed(2)}%`,
        bestApy: `${bestApy.toFixed(2)}%`,
        safestApy: `${safestApy.toFixed(2)}%`,
        opportunityCount: YIELD_OPPORTUNITIES.length,
        btcPrice,
      },
      timestamp: new Date().toISOString(),
      tokenType,
    });
  }
}
