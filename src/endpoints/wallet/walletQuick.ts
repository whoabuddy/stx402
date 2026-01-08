import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import { Str, OpenAPIRouteSchema } from "chanfana";

const HIRO_API = "https://api.hiro.so";
const TENERO_API = "https://api.tenero.io";

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

async function fetchTokenHoldings(address: string): Promise<any[]> {
  try {
    const res = await fetch(`${TENERO_API}/v1/stacks/wallets/${address}/holdings`);
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { rows?: any[] } };
    return (data.data?.rows || []).map((t: any) => ({
      symbol: t.token?.symbol || "UNKNOWN",
      valueUsd: parseFloat(t.value_usd || "0"),
      change24h: t.token?.change_24h ? parseFloat(t.token.change_24h) : null,
    }));
  } catch {
    return [];
  }
}

export class WalletQuickEndpoint extends BaseEndpoint {
  schema: OpenAPIRouteSchema = {
    tags: ["Wallet"],
    summary: "(paid) Quick portfolio summary",
    description: "Fast overview of wallet value and top holdings",
    request: {
      params: { address: new Str({ description: "Stacks address" }) },
    },
    responses: {
      "200": {
        description: "Quick wallet summary",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                address: { type: "string" },
                bnsName: { type: "string", nullable: true },
                summary: { type: "object" },
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

    const [stxPrice, bnsName, stxBalance, tokens] = await Promise.all([
      fetchStxPrice(),
      fetchBnsName(address),
      fetchStxBalance(address),
      fetchTokenHoldings(address),
    ]);

    const tokenValue = tokens.reduce((s, t) => s + t.valueUsd, 0);
    const stxValueUsd = stxBalance * stxPrice;
    const totalValueUsd = tokenValue + stxValueUsd;

    return c.json({
      address,
      bnsName,
      timestamp: new Date().toISOString(),
      summary: {
        totalValueUsd: `$${totalValueUsd.toFixed(2)}`,
        stxBalance: `${stxBalance.toFixed(2)} STX`,
        stxPrice: `$${stxPrice.toFixed(4)}`,
        tokenCount: tokens.length,
        topHoldings: tokens.slice(0, 5).map(t => ({
          symbol: t.symbol,
          value: `$${t.valueUsd.toFixed(2)}`,
          change24h: t.change24h ? `${t.change24h > 0 ? "+" : ""}${t.change24h.toFixed(1)}%` : null,
        })),
      },
      tokenType,
    });
  }
}
