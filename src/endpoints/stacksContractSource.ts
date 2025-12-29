import { sha512_256 } from "@noble/hashes/sha512";
import { bytesToHex } from "@noble/hashes/utils";
import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { getNetworkFromPrincipal } from "../utils/network";

const API_URLS: Record<string, string> = {
  mainnet: "https://api.mainnet.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

export class StacksContractSource extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Get contract source code and hash (cacheable indefinitely)",
    parameters: [
      {
        name: "contract_id",
        in: "path" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Contract identifier (e.g., SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait)",
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
        description: "Contract source and hash",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                contractId: { type: "string" as const },
                source: { type: "string" as const },
                hash: { type: "string" as const, description: "SHA512/256 hash (matches contract-hash?)" },
                publishHeight: { type: "integer" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid contract identifier",
      },
      "402": {
        description: "Payment required",
      },
      "404": {
        description: "Contract not found",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const contractId = c.req.param("contract_id");

    // Validate contract ID format
    const parts = contractId.split(".");
    if (parts.length !== 2) {
      return this.errorResponse(c, "Invalid contract_id format. Expected: ADDRESS.CONTRACT_NAME", 400);
    }

    const [address, contractName] = parts;

    let network: string;
    try {
      network = getNetworkFromPrincipal(address);
    } catch {
      return this.errorResponse(c, "Invalid contract address", 400);
    }

    const apiUrl = API_URLS[network];

    try {
      const response = await fetch(
        `${apiUrl}/v2/contracts/source/${address}/${contractName}`,
        { headers: { Accept: "application/json" } }
      );

      if (response.status === 404) {
        return this.errorResponse(c, "Contract not found", 404);
      }

      if (!response.ok) {
        return this.errorResponse(c, `API error: ${response.status}`, 500);
      }

      const data = await response.json() as { source: string; publish_height: number };

      // Compute SHA512/256 hash (matches Clarity's contract-hash?)
      const encoder = new TextEncoder();
      const sourceBytes = encoder.encode(data.source);
      const hashBytes = sha512_256(sourceBytes);
      const hash = bytesToHex(hashBytes);

      return c.json({
        contractId,
        source: data.source,
        hash,
        publishHeight: data.publish_height,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to fetch contract: ${String(error)}`, 500);
    }
  }
}
