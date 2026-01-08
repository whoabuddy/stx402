import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import { Str, OpenAPIRouteSchema } from "chanfana";

const HIRO_API = "https://api.hiro.so";
const TENERO_API = "https://api.tenero.io";

// Known DeFi protocols
const DEFI_PROTOCOLS: Record<string, { name: string; type: string }> = {
  "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9": { name: "ALEX", type: "dex" },
  "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1": { name: "Velar", type: "dex" },
  "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR": { name: "Arkadiko", type: "lending" },
  "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG": { name: "StackingDAO", type: "staking" },
  "SM3KNVZS30WM7F89SXKVVFY4SN9RMPZZ9FX929N0V": { name: "sBTC", type: "bridge" },
};

const HIGH_RISK_TOKENS = ["WELSH", "LEO", "PEPE", "NOT", "DROID", "ODIN", "ROO"];
const BLUE_CHIP_TOKENS = ["STX", "sBTC", "xBTC", "USDA", "sUSDT", "ALEX", "VELAR"];

// Price cache
let priceCache: { stx: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchStxPrice(): Promise<number> {
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL) {
    return priceCache.stx;
  }
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd");
    if (res.ok) {
      const data = (await res.json()) as { blockstack?: { usd?: number } };
      if (data?.blockstack?.usd) {
        priceCache = { stx: data.blockstack.usd, timestamp: Date.now() };
        return data.blockstack.usd;
      }
    }
  } catch {}
  return priceCache?.stx || 0.85;
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

function categorizeToken(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (BLUE_CHIP_TOKENS.includes(upper)) return "blue-chip";
  if (HIGH_RISK_TOKENS.includes(upper)) return "meme";
  return "other";
}

async function fetchTokenHoldings(address: string): Promise<any[]> {
  try {
    const res = await fetch(`${TENERO_API}/v1/stacks/wallets/${address}/holdings`);
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { rows?: any[] } };
    return (data.data?.rows || []).map((t: any) => ({
      symbol: t.token?.symbol || "UNKNOWN",
      name: t.token?.name || "Unknown",
      contract: t.token_address,
      balance: parseFloat(t.balance_formatted || "0"),
      valueUsd: parseFloat(t.value_usd || "0"),
      priceUsd: parseFloat(t.token?.price_usd || "0"),
      change24h: t.token?.change_24h ? parseFloat(t.token.change_24h) : null,
      category: categorizeToken(t.token?.symbol || ""),
    }));
  } catch {
    return [];
  }
}

async function fetchNFTHoldings(address: string): Promise<any[]> {
  try {
    const res = await fetch(`${HIRO_API}/extended/v1/tokens/nft/holdings?principal=${address}&limit=100`);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: any[] };
    const collections: Record<string, { name: string; count: number }> = {};
    for (const nft of data.results || []) {
      const id = nft.asset_identifier?.split("::")[0] || "Unknown";
      const name = id.split(".").pop() || "Unknown";
      if (!collections[id]) collections[id] = { name, count: 0 };
      collections[id].count++;
    }
    return Object.entries(collections).map(([collection, data]) => ({
      collection,
      name: data.name,
      count: data.count,
    }));
  } catch {
    return [];
  }
}

async function fetchActivity(address: string): Promise<{ txCount30d: number; lastActive: string | null; defi: any[]; topInteractions: string[] }> {
  try {
    const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/transactions?limit=100`);
    if (!res.ok) return { txCount30d: 0, lastActive: null, defi: [], topInteractions: [] };
    const data = (await res.json()) as { results?: any[] };
    const txs = data.results || [];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = txs.filter((tx: any) => new Date(tx.burn_block_time_iso).getTime() > thirtyDaysAgo);

    const defiMap: Record<string, { name: string; type: string; count: number }> = {};
    const interactions: Record<string, number> = {};

    for (const tx of txs) {
      if (tx.tx_type === "contract_call" && tx.contract_call?.contract_id) {
        const contract = tx.contract_call.contract_id;
        const deployer = contract.split(".")[0];
        interactions[contract] = (interactions[contract] || 0) + 1;

        if (DEFI_PROTOCOLS[deployer]) {
          const proto = DEFI_PROTOCOLS[deployer];
          if (!defiMap[proto.name]) defiMap[proto.name] = { ...proto, count: 0 };
          defiMap[proto.name].count++;
        }
      }
    }

    return {
      txCount30d: recent.length,
      lastActive: txs[0]?.burn_block_time_iso || null,
      defi: Object.values(defiMap),
      topInteractions: Object.entries(interactions).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c),
    };
  } catch {
    return { txCount30d: 0, lastActive: null, defi: [], topInteractions: [] };
  }
}

function generateInsights(data: any): any[] {
  const insights: any[] = [];
  const { summary, allocation, tokens, defi } = data;

  if (summary.riskLevel === "high") {
    insights.push({
      type: "risk",
      title: "High Risk Profile",
      description: `${Math.round(allocation.meme * 100)}% in high-volatility tokens`,
      action: "Consider rebalancing into stable assets like STX, sBTC, or USDA",
    });
  }

  if (allocation.stx < 0.1 && summary.totalValueUsd > 100) {
    insights.push({
      type: "warning",
      title: "Low STX Balance",
      description: "STX needed for transaction fees and stacking",
      action: "Hold at least 10% in STX",
    });
  }

  if (defi.length === 0 && summary.stxBalance > 100) {
    insights.push({
      type: "opportunity",
      title: "DeFi Opportunities",
      description: "Your STX could be earning yield",
      action: "Explore stacking via StackingDAO or liquidity provision on ALEX",
    });
  }

  if (summary.stxBalance > 500) {
    insights.push({
      type: "opportunity",
      title: "Stacking Available",
      description: `${summary.stxBalance.toFixed(0)} STX could earn ~8-10% APY`,
      action: "Use liquid stacking protocols like StackingDAO",
    });
  }

  if (summary.activityLevel === "inactive") {
    insights.push({
      type: "info",
      title: "Dormant Wallet",
      description: "No transactions in 30 days",
      action: "Assets may be missing yield opportunities",
    });
  }

  return insights;
}

export class WalletAnalyzeEndpoint extends BaseEndpoint {
  schema: OpenAPIRouteSchema = {
    tags: ["Wallet"],
    summary: "(paid) Full wallet intelligence report",
    description: "Deep analysis including holdings, DeFi positions, risk score, and actionable insights",
    request: {
      params: { address: new Str({ description: "Stacks address to analyze" }) },
    },
    responses: {
      "200": {
        description: "Wallet intelligence report",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                address: { type: "string" },
                bnsName: { type: "string", nullable: true },
                summary: { type: "object" },
                allocation: { type: "object" },
                tokens: { type: "array" },
                nfts: { type: "array" },
                defi: { type: "array" },
                recentActivity: { type: "object" },
                insights: { type: "array" },
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
    const [stxPrice, bnsName, stxBalance, tokens, nfts, activity] = await Promise.all([
      fetchStxPrice(),
      fetchBnsName(address),
      fetchStxBalance(address),
      fetchTokenHoldings(address),
      fetchNFTHoldings(address),
      fetchActivity(address),
    ]);

    // Calculate values
    const tokenValue = tokens.reduce((s, t) => s + t.valueUsd, 0);
    const stxValueUsd = stxBalance * stxPrice;
    const totalValueUsd = tokenValue + stxValueUsd;

    // Allocation breakdown
    const blueChip = tokens.filter(t => t.category === "blue-chip").reduce((s, t) => s + t.valueUsd, 0);
    const meme = tokens.filter(t => t.category === "meme").reduce((s, t) => s + t.valueUsd, 0);
    const allocation = {
      stx: totalValueUsd > 0 ? stxValueUsd / totalValueUsd : 0,
      blueChip: totalValueUsd > 0 ? blueChip / totalValueUsd : 0,
      meme: totalValueUsd > 0 ? meme / totalValueUsd : 0,
      other: totalValueUsd > 0 ? (totalValueUsd - stxValueUsd - blueChip - meme) / totalValueUsd : 0,
    };

    // Risk calculation
    let riskScore = Math.min(Math.round(allocation.meme * 80 + (tokens.length <= 2 ? 20 : 0)), 100);
    const riskLevel = riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";

    // Activity level
    const activityLevel = totalValueUsd > 100000 ? "whale" :
      activity.txCount30d === 0 ? "inactive" :
      activity.txCount30d < 5 ? "low" :
      activity.txCount30d < 20 ? "moderate" : "high";

    const summary = {
      totalValueUsd,
      stxBalance,
      stxPrice,
      tokenCount: tokens.length,
      nftCount: nfts.reduce((s, n) => s + n.count, 0),
      defiProtocols: activity.defi.length,
      riskScore,
      riskLevel,
      activityLevel,
    };

    const report = {
      address,
      bnsName,
      timestamp: new Date().toISOString(),
      summary,
      allocation,
      tokens: tokens.sort((a, b) => b.valueUsd - a.valueUsd),
      nfts: nfts.sort((a, b) => b.count - a.count),
      defi: activity.defi,
      recentActivity: {
        txCount30d: activity.txCount30d,
        lastActive: activity.lastActive,
        topInteractions: activity.topInteractions,
      },
      insights: generateInsights({ summary, allocation, tokens, defi: activity.defi }),
      tokenType,
    };

    return c.json(report);
  }
}
