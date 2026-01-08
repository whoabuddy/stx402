import { sha512_256 } from "@noble/hashes/sha512";
import { bytesToHex } from "@noble/hashes/utils";
import { BaseEndpoint } from "./BaseEndpoint";
import { getNameFromAddress } from "../utils/bns";
import { getNetworkFromPrincipal } from "../utils/network";
import { hiroFetch, getHiroApiUrl, isHiroRateLimitError } from "../utils/hiro";
import type { AppContext } from "../types";

interface AccountBalance {
  stx: {
    balance: string;
    total_sent: string;
    total_received: string;
    locked: string;
    lock_height: number;
  };
  fungible_tokens: Record<string, { balance: string }>;
  non_fungible_tokens: Record<string, { count: number }>;
  nonce: number;
}

interface CoreApiInfo {
  burn_block_height: number;
  stacks_tip_height: number;
}

export class StacksProfile extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Get aggregated profile: BNS, STX balance, FT balances, NFT count, block height",
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
        description: "Aggregated profile data",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                address: { type: "string" as const },
                network: { type: "string" as const },
                bnsName: { type: "string" as const, nullable: true },
                stxBalance: {
                  type: "object" as const,
                  properties: {
                    balance: { type: "string" as const },
                    formatted: { type: "string" as const },
                    locked: { type: "string" as const },
                  },
                },
                ftBalances: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      token: { type: "string" as const },
                      balance: { type: "string" as const },
                    },
                  },
                },
                nftCount: { type: "integer" as const },
                blockHeight: {
                  type: "object" as const,
                  properties: {
                    stacks: { type: "integer" as const },
                    burn: { type: "integer" as const },
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
      const [bnsName, balanceResponse, infoResponse] = await Promise.all([
        getNameFromAddress(address).catch(() => null),
        hiroFetch(`${apiUrl}/extended/v1/address/${address}/balances`, {
          headers: { Accept: "application/json" },
        }),
        hiroFetch(`${apiUrl}/v2/info`, {
          headers: { Accept: "application/json" },
        }),
      ]);

      // Parse balance data
      let stxBalance = { balance: "0", formatted: "0.000000", locked: "0" };
      let ftBalances: { token: string; balance: string }[] = [];
      let nftCount = 0;

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json() as AccountBalance;

        if (balanceData.stx) {
          const balanceMicro = BigInt(balanceData.stx.balance || "0");
          const balanceStx = Number(balanceMicro) / 1_000_000;
          stxBalance = {
            balance: balanceData.stx.balance || "0",
            formatted: balanceStx.toFixed(6),
            locked: balanceData.stx.locked || "0",
          };
        }

        // Parse FT balances
        if (balanceData.fungible_tokens) {
          ftBalances = Object.entries(balanceData.fungible_tokens).map(([contractId, data]) => {
            const [contract, assetName] = contractId.split("::");
            return {
              token: assetName ? `${contract}::${assetName}` : contract,
              balance: data.balance,
            };
          });
        }

        // Count NFTs
        if (balanceData.non_fungible_tokens) {
          nftCount = Object.values(balanceData.non_fungible_tokens).reduce(
            (sum, data) => sum + (data.count || 0),
            0
          );
        }
      }

      // Parse block height
      let blockHeight = { stacks: 0, burn: 0 };
      if (infoResponse.ok) {
        const infoData = await infoResponse.json() as CoreApiInfo;
        blockHeight = {
          stacks: infoData.stacks_tip_height,
          burn: infoData.burn_block_height,
        };
      }

      return c.json({
        address,
        network,
        bnsName,
        stxBalance,
        ftBalances,
        nftCount,
        blockHeight,
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
      return this.errorResponse(c, `Failed to fetch profile: ${String(error)}`, 500);
    }
  }
}
