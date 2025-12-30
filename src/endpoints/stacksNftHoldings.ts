import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { getNetworkFromPrincipal } from "../utils/network";
import { hiroFetch, getHiroApiUrl, isHiroRateLimitError } from "../utils/hiro";

interface NftHolding {
  asset_identifier: string;
  value: { hex: string; repr: string };
  block_height: number;
  tx_id: string;
}

interface NftResponse {
  total: number;
  limit: number;
  offset: number;
  results: NftHolding[];
}

export class StacksNftHoldings extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Get NFT holdings for an address",
    parameters: [
      {
        name: "address",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Stacks address",
      },
      {
        name: "limit",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const, default: 50, maximum: 200 },
        description: "Max results (default 50, max 200)",
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
        description: "NFT holdings",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                address: { type: "string" as const },
                nfts: { type: "array" as const },
                total: { type: "integer" as const },
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
    const limit = Math.min(200, parseInt(c.req.query("limit") || "50", 10));

    let network: string;
    try {
      network = getNetworkFromPrincipal(address);
    } catch {
      return this.errorResponse(c, "Invalid Stacks address", 400);
    }

    const apiUrl = getHiroApiUrl(network as "mainnet" | "testnet");

    try {
      const response = await hiroFetch(
        `${apiUrl}/extended/v1/tokens/nft/holdings?principal=${address}&limit=${limit}`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) {
        return this.errorResponse(c, `API error: ${response.status}`, 500);
      }

      const data = await response.json() as NftResponse;

      // Parse NFTs into cleaner format
      const nfts = data.results.map((nft) => {
        const [contractId, assetName] = nft.asset_identifier.split("::");
        return {
          contractId,
          assetName,
          tokenId: nft.value.repr,
          blockHeight: nft.block_height,
          txId: nft.tx_id,
        };
      });

      // Group by collection
      const byCollection: Record<string, number> = {};
      nfts.forEach((nft) => {
        byCollection[nft.contractId] = (byCollection[nft.contractId] || 0) + 1;
      });

      return c.json({
        address,
        nfts,
        total: data.total,
        returned: nfts.length,
        collections: Object.entries(byCollection).map(([id, count]) => ({ contractId: id, count })),
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
      return this.errorResponse(c, `Failed to fetch NFTs: ${String(error)}`, 500);
    }
  }
}
