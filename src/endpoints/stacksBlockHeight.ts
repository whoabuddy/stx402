import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

const API_URLS: Record<string, string> = {
  mainnet: "https://api.mainnet.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

interface CoreApiInfo {
  burn_block_height: number;
  stable_burn_block_height: number;
  stacks_tip_height: number;
  stacks_tip: string;
  stacks_tip_consensus_hash: string;
  server_version: string;
  network_id: number;
  parent_network_id: number;
  pox_consensus: string;
}

export class StacksBlockHeight extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Get current Stacks block height and network status",
    parameters: [
      {
        name: "network",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["mainnet", "testnet"] as const,
          default: "mainnet",
        },
        description: "Network to query",
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
        description: "Block height and network info",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                stacksBlockHeight: { type: "integer" as const },
                burnBlockHeight: { type: "integer" as const },
                stacksTip: { type: "string" as const },
                serverVersion: { type: "string" as const },
                network: { type: "string" as const },
                poxConsensus: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "402": {
        description: "Payment required",
      },
      "500": {
        description: "Failed to fetch network info",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = c.req.query("network") || "mainnet";

    if (network !== "mainnet" && network !== "testnet") {
      return this.errorResponse(c, "network must be 'mainnet' or 'testnet'", 400);
    }

    const apiUrl = API_URLS[network];

    try {
      const response = await fetch(`${apiUrl}/v2/info`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return this.errorResponse(c, `API error: ${response.status}`, 500);
      }

      const data = await response.json() as CoreApiInfo;

      return c.json({
        stacksBlockHeight: data.stacks_tip_height,
        burnBlockHeight: data.burn_block_height,
        stableBurnBlockHeight: data.stable_burn_block_height,
        stacksTip: data.stacks_tip,
        stacksTipConsensusHash: data.stacks_tip_consensus_hash,
        serverVersion: data.server_version,
        poxConsensus: data.pox_consensus,
        networkId: data.network_id,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to fetch network info: ${String(error)}`, 500);
    }
  }
}
