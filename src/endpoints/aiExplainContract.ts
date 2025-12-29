import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { getNetworkFromPrincipal } from "../utils/network";

const API_URLS: Record<string, string> = {
  mainnet: "https://api.mainnet.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

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

export class AiExplainContract extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) AI analysis of a Clarity smart contract",
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
        description: "Contract analysis",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                contractId: { type: "string" as const },
                explanation: { type: "string" as const },
                category: { type: "string" as const },
                riskFlags: {
                  type: "array" as const,
                  items: { type: "string" as const },
                },
                functionSummaries: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      name: { type: "string" as const },
                      purpose: { type: "string" as const },
                      access: { type: "string" as const },
                    },
                  },
                },
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
      // Fetch both source and ABI in parallel
      const [sourceRes, abiRes] = await Promise.all([
        fetch(`${apiUrl}/v2/contracts/source/${address}/${contractName}`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${apiUrl}/v2/contracts/interface/${address}/${contractName}`, {
          headers: { Accept: "application/json" },
        }),
      ]);

      if (sourceRes.status === 404 || abiRes.status === 404) {
        return this.errorResponse(c, "Contract not found", 404);
      }

      if (!sourceRes.ok || !abiRes.ok) {
        return this.errorResponse(c, "API error fetching contract data", 500);
      }

      const sourceData = await sourceRes.json() as { source: string };
      const abi = await abiRes.json() as ClarityAbi;

      // Build prompt for AI analysis
      const prompt = `Analyze this Clarity smart contract and provide:
1. A brief explanation of what this contract does (2-3 sentences)
2. A category (e.g., "NFT", "DeFi", "Token", "DAO", "Utility", "Game", "Bridge", "Oracle")
3. Any risk flags or concerns (empty array if none)
4. A one-line purpose for each public/read-only function

Contract ID: ${contractId}

Contract Source:
\`\`\`clarity
${sourceData.source.substring(0, 8000)}
\`\`\`

ABI Summary:
- Public functions: ${abi.functions.filter(f => f.access === "public").map(f => f.name).join(", ") || "none"}
- Read-only functions: ${abi.functions.filter(f => f.access === "read_only").map(f => f.name).join(", ") || "none"}
- FTs: ${abi.fungible_tokens?.map(t => t.name).join(", ") || "none"}
- NFTs: ${abi.non_fungible_tokens?.map(t => t.name).join(", ") || "none"}
- Maps: ${abi.maps?.map(m => m.name).join(", ") || "none"}

Respond in JSON format:
{
  "explanation": "...",
  "category": "...",
  "riskFlags": [...],
  "functionSummaries": [{"name": "...", "purpose": "...", "access": "public|read_only"}]
}`;

      const aiResult = await c.env.AI.run("@cf/meta/llama-3-8b-instruct", {
        prompt,
        max_tokens: 1500,
        temperature: 0.3,
      });

      // Parse AI response
      let analysis: {
        explanation: string;
        category: string;
        riskFlags: string[];
        functionSummaries: Array<{ name: string; purpose: string; access: string }>;
      };

      try {
        // Extract JSON from response
        const jsonMatch = aiResult.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch {
        // Fallback if JSON parsing fails
        analysis = {
          explanation: aiResult.response.substring(0, 500),
          category: "Unknown",
          riskFlags: [],
          functionSummaries: abi.functions
            .filter((f) => f.access !== "private")
            .map((f) => ({
              name: f.name,
              purpose: "See contract source",
              access: f.access,
            })),
        };
      }

      return c.json({
        contractId,
        explanation: analysis.explanation,
        category: analysis.category,
        riskFlags: analysis.riskFlags || [],
        functionSummaries: analysis.functionSummaries || [],
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to analyze contract: ${String(error)}`, 500);
    }
  }
}
