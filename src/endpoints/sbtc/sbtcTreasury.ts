import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import { Str, OpenAPIRouteSchema } from "chanfana";

const HIRO_API = "https://api.hiro.so";

// sBTC contract on mainnet
const SBTC_CONTRACT = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const SBTC_DECIMALS = 8;

// Known sBTC yield protocols
const YIELD_PROTOCOLS: Record<string, { name: string; type: string; contract: string; method: string }> = {
  "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-v1": {
    name: "StackingDAO",
    type: "liquid-stacking",
    contract: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-v1",
    method: "get-user-data",
  },
  "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.amm-pool-v2-01": {
    name: "ALEX sBTC Pool",
    type: "amm-lp",
    contract: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.amm-pool-v2-01",
    method: "get-balance",
  },
};

// Price cache
let priceCache: { btc: number; stx: number; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute

async function fetchPrices(): Promise<{ btc: number; stx: number }> {
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL) {
    return { btc: priceCache.btc, stx: priceCache.stx };
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,blockstack&vs_currencies=usd"
    );
    if (res.ok) {
      const data = (await res.json()) as { bitcoin?: { usd?: number }; blockstack?: { usd?: number } };
      const btc = data?.bitcoin?.usd || 97000;
      const stx = data?.blockstack?.usd || 1.5;
      priceCache = { btc, stx, timestamp: Date.now() };
      return { btc, stx };
    }
  } catch {}
  return { btc: priceCache?.btc || 97000, stx: priceCache?.stx || 1.5 };
}

async function fetchSbtcBalance(address: string): Promise<{ balance: bigint; formatted: number }> {
  try {
    const [contractAddress, contractName] = SBTC_CONTRACT.split(".");
    const res = await fetch(
      `${HIRO_API}/extended/v1/address/${address}/balances`
    );
    if (!res.ok) return { balance: 0n, formatted: 0 };

    const data = (await res.json()) as {
      fungible_tokens?: Record<string, { balance: string }>;
    };

    const sbtcKey = Object.keys(data.fungible_tokens || {}).find(k =>
      k.includes("sbtc") || k.includes("sBTC")
    );

    if (sbtcKey && data.fungible_tokens?.[sbtcKey]) {
      const balance = BigInt(data.fungible_tokens[sbtcKey].balance);
      const formatted = Number(balance) / Math.pow(10, SBTC_DECIMALS);
      return { balance, formatted };
    }
    return { balance: 0n, formatted: 0 };
  } catch {
    return { balance: 0n, formatted: 0 };
  }
}

async function fetchStxBalance(address: string): Promise<number> {
  try {
    const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/stx`);
    if (!res.ok) return 0;
    const data = (await res.json()) as { balance?: string };
    return parseInt(data.balance || "0") / 1_000_000;
  } catch {
    return 0;
  }
}

async function fetchYieldPositions(address: string): Promise<Array<{
  protocol: string;
  type: string;
  deposited: number;
  currentValue: number;
  rewards: number;
  apy: number;
}>> {
  // In production, this would query each protocol's contracts
  // For now, we detect positions from transaction history
  const positions: Array<{
    protocol: string;
    type: string;
    deposited: number;
    currentValue: number;
    rewards: number;
    apy: number;
  }> = [];

  try {
    const res = await fetch(
      `${HIRO_API}/extended/v1/address/${address}/transactions?limit=50`
    );
    if (!res.ok) return positions;

    const data = (await res.json()) as { results?: Array<{
      tx_type: string;
      contract_call?: { contract_id: string; function_name: string };
    }> };

    const protocolInteractions = new Set<string>();

    for (const tx of data.results || []) {
      if (tx.tx_type === "contract_call" && tx.contract_call?.contract_id) {
        const contract = tx.contract_call.contract_id;
        const deployer = contract.split(".")[0];

        // Check for sBTC-related DeFi interactions
        if (contract.toLowerCase().includes("sbtc") ||
            contract.toLowerCase().includes("bitcoin") ||
            YIELD_PROTOCOLS[contract]) {
          protocolInteractions.add(contract);
        }

        // Known DeFi protocols
        if (deployer === "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9") {
          protocolInteractions.add("ALEX");
        }
        if (deployer === "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG") {
          protocolInteractions.add("StackingDAO");
        }
        if (deployer === "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1") {
          protocolInteractions.add("Velar");
        }
      }
    }

    // Note: Real implementation would query on-chain positions
    // This detects protocol usage for the treasury view
    for (const protocol of protocolInteractions) {
      if (protocol === "ALEX") {
        positions.push({
          protocol: "ALEX",
          type: "amm-lp",
          deposited: 0,
          currentValue: 0,
          rewards: 0,
          apy: 12.5,
        });
      }
      if (protocol === "StackingDAO") {
        positions.push({
          protocol: "StackingDAO",
          type: "liquid-stacking",
          deposited: 0,
          currentValue: 0,
          rewards: 0,
          apy: 8.0,
        });
      }
    }
  } catch {}

  return positions;
}

async function fetchBnsName(address: string): Promise<string | null> {
  try {
    const res = await fetch(`${HIRO_API}/v1/addresses/stacks/${address}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { names?: string[] };
    return data.names?.[0] || null;
  } catch {
    return null;
  }
}

export class SbtcTreasury extends BaseEndpoint {
  schema: OpenAPIRouteSchema = {
    tags: ["sBTC"],
    summary: "(paid) Complete sBTC treasury view for AI agents",
    description: "Full view of sBTC holdings, yield positions, and portfolio health - designed for AI agent treasury management",
    request: {
      params: { address: new Str({ description: "Stacks address" }) },
    },
    responses: {
      "200": {
        description: "Treasury dashboard",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                address: { type: "string" },
                identity: { type: "object" },
                holdings: { type: "object" },
                yields: { type: "array" },
                summary: { type: "object" },
                recommendations: { type: "array" },
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
    const address = c.req.param("address");

    if (!address?.startsWith("SP") && !address?.startsWith("SM")) {
      return this.errorResponse(c, "Invalid Stacks address", 400);
    }

    // Fetch all data in parallel
    const [prices, sbtcBalance, stxBalance, yieldPositions, bnsName] = await Promise.all([
      fetchPrices(),
      fetchSbtcBalance(address),
      fetchStxBalance(address),
      fetchYieldPositions(address),
      fetchBnsName(address),
    ]);

    // Calculate values
    const sbtcValueUsd = sbtcBalance.formatted * prices.btc;
    const stxValueUsd = stxBalance * prices.stx;
    const totalYieldValue = yieldPositions.reduce((s, p) => s + p.currentValue, 0);
    const totalValueUsd = sbtcValueUsd + stxValueUsd + totalYieldValue * prices.btc;
    const pendingRewards = yieldPositions.reduce((s, p) => s + p.rewards, 0);

    // Calculate weighted average APY
    const totalDeposited = yieldPositions.reduce((s, p) => s + p.deposited, 0);
    const weightedApy = totalDeposited > 0
      ? yieldPositions.reduce((s, p) => s + (p.apy * p.deposited / totalDeposited), 0)
      : 0;

    // Health score (0-100)
    let healthScore = 50; // Base
    if (sbtcBalance.formatted > 0) healthScore += 20; // Has sBTC
    if (stxBalance > 10) healthScore += 10; // Has STX for fees
    if (yieldPositions.length > 0) healthScore += 10; // Earning yield
    if (yieldPositions.length > 1) healthScore += 10; // Diversified
    healthScore = Math.min(healthScore, 100);

    // Generate recommendations
    const recommendations: Array<{ priority: string; action: string; reason: string; impact: string }> = [];

    if (sbtcBalance.formatted > 0.001 && yieldPositions.length === 0) {
      recommendations.push({
        priority: "high",
        action: "deposit_yield",
        reason: "Idle sBTC not earning yield",
        impact: `+${(sbtcBalance.formatted * 0.08).toFixed(6)} sBTC/year at 8% APY`,
      });
    }

    if (stxBalance < 1 && sbtcBalance.formatted > 0) {
      recommendations.push({
        priority: "high",
        action: "acquire_stx",
        reason: "Low STX balance for transaction fees",
        impact: "Ensure ability to execute transactions",
      });
    }

    if (sbtcBalance.formatted > 0.01 && yieldPositions.length === 1) {
      recommendations.push({
        priority: "medium",
        action: "diversify",
        reason: "Single protocol concentration risk",
        impact: "Reduce protocol-specific risk exposure",
      });
    }

    if (pendingRewards > 0.0001) {
      recommendations.push({
        priority: "low",
        action: "claim_rewards",
        reason: `${pendingRewards.toFixed(6)} sBTC in unclaimed rewards`,
        impact: `Compound earnings or redeploy capital`,
      });
    }

    return c.json({
      address,
      identity: {
        bnsName,
        type: "agent-treasury",
      },
      holdings: {
        sbtc: {
          balance: sbtcBalance.formatted,
          balanceSats: sbtcBalance.balance.toString(),
          valueUsd: sbtcValueUsd,
          price: prices.btc,
        },
        stx: {
          balance: stxBalance,
          valueUsd: stxValueUsd,
          price: prices.stx,
        },
      },
      yields: yieldPositions.map(p => ({
        ...p,
        valueUsd: p.currentValue * prices.btc,
      })),
      summary: {
        totalValueUsd,
        totalSbtcEquivalent: totalValueUsd / prices.btc,
        activePositions: yieldPositions.length,
        weightedApy: `${weightedApy.toFixed(2)}%`,
        pendingRewards,
        pendingRewardsUsd: pendingRewards * prices.btc,
        healthScore,
        healthLevel: healthScore >= 80 ? "excellent" : healthScore >= 60 ? "good" : healthScore >= 40 ? "fair" : "needs-attention",
      },
      recommendations,
      prices: {
        btcUsd: prices.btc,
        stxUsd: prices.stx,
        timestamp: new Date().toISOString(),
      },
      tokenType,
    });
  }
}
