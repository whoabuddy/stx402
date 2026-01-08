import { sha512_256 } from "@noble/hashes/sha512";
import { bytesToHex } from "@noble/hashes/utils";
import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { getNetworkFromPrincipal } from "../utils/network";
import { hiroFetch, getHiroApiUrl, isHiroRateLimitError } from "../utils/hiro";

interface ClarityAbiFunction {
  name: string;
  access: "public" | "read_only" | "private";
  args: Array<{ name: string; type: unknown }>;
  outputs: { type: unknown };
}

interface ClarityAbi {
  functions: ClarityAbiFunction[];
  variables: Array<{ name: string; access: string; type: unknown }>;
  maps: Array<{ name: string; key: unknown; value: unknown }>;
  fungible_tokens: Array<{ name: string }>;
  non_fungible_tokens: Array<{ name: string; type: unknown }>;
}

export class StacksContractInfo extends BaseEndpoint {
  schema = {
    tags: ["Stacks"],
    summary: "(paid) Get contract source and ABI (cacheable indefinitely)",
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
        description: "Contract source and ABI",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                contractId: { type: "string" as const },
                network: { type: "string" as const },
                source: { type: "string" as const },
                sourceHash: { type: "string" as const, description: "SHA512/256 hash" },
                publishHeight: { type: "integer" as const },
                abi: {
                  type: "object" as const,
                  properties: {
                    functions: { type: "array" as const },
                    variables: { type: "array" as const },
                    maps: { type: "array" as const },
                    fungible_tokens: { type: "array" as const },
                    non_fungible_tokens: { type: "array" as const },
                  },
                },
                summary: {
                  type: "object" as const,
                  properties: {
                    publicFunctions: { type: "integer" as const },
                    readOnlyFunctions: { type: "integer" as const },
                    privateFunctions: { type: "integer" as const },
                    variables: { type: "integer" as const },
                    maps: { type: "integer" as const },
                    fungibleTokens: { type: "integer" as const },
                    nonFungibleTokens: { type: "integer" as const },
                  },
                },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid contract identifier" },
      "402": { description: "Payment required" },
      "404": { description: "Contract not found" },
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

    const apiUrl = getHiroApiUrl(network as "mainnet" | "testnet");

    try {
      // Fetch source and ABI in parallel
      const [sourceResponse, abiResponse] = await Promise.all([
        hiroFetch(`${apiUrl}/v2/contracts/source/${address}/${contractName}`, {
          headers: { Accept: "application/json" },
        }),
        hiroFetch(`${apiUrl}/v2/contracts/interface/${address}/${contractName}`, {
          headers: { Accept: "application/json" },
        }),
      ]);

      // Check for 404 on either response
      if (sourceResponse.status === 404 || abiResponse.status === 404) {
        return this.errorResponse(c, "Contract not found", 404);
      }

      if (!sourceResponse.ok) {
        return this.errorResponse(c, `API error fetching source: ${sourceResponse.status}`, 500);
      }

      if (!abiResponse.ok) {
        return this.errorResponse(c, `API error fetching ABI: ${abiResponse.status}`, 500);
      }

      const sourceData = await sourceResponse.json() as { source: string; publish_height: number };
      const abi = await abiResponse.json() as ClarityAbi;

      // Compute SHA512/256 hash (matches Clarity's contract-hash?)
      const encoder = new TextEncoder();
      const sourceBytes = encoder.encode(sourceData.source);
      const hashBytes = sha512_256(sourceBytes);
      const sourceHash = bytesToHex(hashBytes);

      // Generate summary
      const summary = {
        publicFunctions: abi.functions.filter((f) => f.access === "public").length,
        readOnlyFunctions: abi.functions.filter((f) => f.access === "read_only").length,
        privateFunctions: abi.functions.filter((f) => f.access === "private").length,
        variables: abi.variables?.length || 0,
        maps: abi.maps?.length || 0,
        fungibleTokens: abi.fungible_tokens?.length || 0,
        nonFungibleTokens: abi.non_fungible_tokens?.length || 0,
      };

      return c.json({
        contractId,
        network,
        source: sourceData.source,
        sourceHash,
        publishHeight: sourceData.publish_height,
        abi,
        summary,
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
      return this.errorResponse(c, `Failed to fetch contract info: ${String(error)}`, 500);
    }
  }
}
