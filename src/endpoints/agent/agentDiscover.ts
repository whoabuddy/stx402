import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  extractTypedValue,
  isSome,
  isNone,
  isTuple,
  uint,
  principal,
  list,
  stringUtf8,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

// Agent registration file structure
interface AgentRegistrationFile {
  name?: string;
  description?: string;
  endpoints?: {
    mcp?: string[];
    a2a?: string[];
    http?: string[];
  };
  capabilities?: string[];
  version?: string;
}

// Discovered agent summary
interface DiscoveredAgent {
  agentId: number;
  globalId: string;
  owner: string;
  uri: string | null;
  name: string | null;
  description: string | null;
  capabilities: string[];
  endpoints: {
    mcp: number;
    a2a: number;
    http: number;
  };
  reputation: {
    score: number;
    count: number;
  };
}

// Fetch registration file with timeout
async function fetchRegistrationFile(uri: string, timeout = 3000): Promise<AgentRegistrationFile | null> {
  if (!uri) return null;

  try {
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
      fetchUrl = `https://ipfs.io/ipfs/${uri.slice(7)}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(fetchUrl, {
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return await res.json() as AgentRegistrationFile;
  } catch {
    return null;
  }
}

export class AgentDiscover extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Discover agents by capabilities or reputation",
    description: "Search for agents matching specific criteria - capabilities, minimum reputation, or endpoint types",
    requestBody: {
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              capabilities: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "Filter by capabilities (e.g., ['code-generation', 'data-analysis'])",
              },
              minReputation: {
                type: "number" as const,
                description: "Minimum reputation score (0-100)",
                minimum: 0,
                maximum: 100,
              },
              endpointType: {
                type: "string" as const,
                enum: ["mcp", "a2a", "http"] as const,
                description: "Filter by endpoint type",
              },
              limit: {
                type: "number" as const,
                description: "Maximum results (default 10, max 50)",
                default: 10,
                maximum: 50,
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "network",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["mainnet", "testnet"] as const,
          default: "testnet",
        },
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
        description: "Discovered agents",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agents: { type: "array" as const },
                totalScanned: { type: "number" as const },
                filters: { type: "object" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "501": { description: "Network not supported" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = (c.req.query("network") || "testnet") as ERC8004Network;

    if (network === "mainnet" && !ERC8004_CONTRACTS.mainnet) {
      return this.errorResponse(c, "ERC-8004 contracts not yet deployed on mainnet", 501);
    }

    let body: {
      capabilities?: string[];
      minReputation?: number;
      endpointType?: "mcp" | "a2a" | "http";
      limit?: number;
    } = {};

    try {
      const text = await c.req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const capabilities = body.capabilities || [];
    const minReputation = body.minReputation ?? 0;
    const endpointType = body.endpointType;
    const limit = Math.min(body.limit || 10, 50);

    const contracts = ERC8004_CONTRACTS[network]!;
    const chainId = network === "mainnet" ? 1 : 2147483648;

    try {
      // Get current agent count from identity registry
      const countResult = await callRegistryFunction(network, "identity", "get-last-token-id", []);
      const countJson = clarityToJson(countResult);
      const lastTokenId = parseInt(extractTypedValue(extractValue(countJson)) as string || "0", 10);

      if (lastTokenId === 0) {
        return c.json({
          agents: [],
          totalScanned: 0,
          totalRegistered: 0,
          filters: { capabilities, minReputation, endpointType, limit },
          network,
          tokenType,
        });
      }

      const discovered: DiscoveredAgent[] = [];
      let scanned = 0;

      // Scan agents (newest first for freshness)
      for (let agentId = lastTokenId; agentId >= 0 && discovered.length < limit; agentId--) {
        scanned++;

        // Fetch owner and URI
        const [ownerResult, uriResult] = await Promise.all([
          callRegistryFunction(network, "identity", "owner-of", [uint(agentId)]),
          callRegistryFunction(network, "identity", "get-uri", [uint(agentId)]),
        ]);

        const ownerJson = clarityToJson(ownerResult);
        if (isNone(ownerJson)) continue; // Agent doesn't exist

        const owner = extractTypedValue(extractValue(ownerJson)) as string;

        const uriJson = clarityToJson(uriResult);
        let uri: string | null = null;
        if (isSome(uriJson)) {
          uri = extractTypedValue(extractValue(uriJson)) as string;
        }

        // Fetch reputation
        const repResult = await callRegistryFunction(network, "reputation", "get-summary", [
          uint(agentId),
          list([]),
          stringUtf8(""),
          stringUtf8(""),
        ]);
        const repJson = clarityToJson(repResult);
        let repScore = 0;
        let repCount = 0;
        if (isTuple(repJson)) {
          const repValue = repJson as { value: { count?: { value: string }; "average-score"?: { value: string } } };
          repCount = parseInt(repValue.value?.count?.value || "0", 10);
          repScore = parseInt(repValue.value?.["average-score"]?.value || "0", 10);
        }

        // Apply reputation filter
        if (repCount > 0 && repScore < minReputation) continue;

        // Fetch and parse registration file
        let regFile: AgentRegistrationFile | null = null;
        if (uri) {
          regFile = await fetchRegistrationFile(uri);
        }

        // Apply capability filter
        if (capabilities.length > 0) {
          const agentCapabilities = regFile?.capabilities || [];
          const hasAllCapabilities = capabilities.every(cap =>
            agentCapabilities.some(ac => ac.toLowerCase().includes(cap.toLowerCase()))
          );
          if (!hasAllCapabilities) continue;
        }

        // Apply endpoint type filter
        if (endpointType) {
          const endpoints = regFile?.endpoints;
          if (!endpoints) continue;
          const endpointList = endpoints[endpointType];
          if (!endpointList || endpointList.length === 0) continue;
        }

        // Build discovered agent
        discovered.push({
          agentId,
          globalId: `stacks:${chainId}:${contracts.identity}:${agentId}`,
          owner,
          uri,
          name: regFile?.name || null,
          description: regFile?.description || null,
          capabilities: regFile?.capabilities || [],
          endpoints: {
            mcp: regFile?.endpoints?.mcp?.length || 0,
            a2a: regFile?.endpoints?.a2a?.length || 0,
            http: regFile?.endpoints?.http?.length || 0,
          },
          reputation: {
            score: repScore,
            count: repCount,
          },
        });

        // Early exit if we have enough results
        if (discovered.length >= limit) break;

        // Rate limit protection - don't scan too fast
        if (scanned % 5 === 0) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      // Sort by reputation score (highest first)
      discovered.sort((a, b) => {
        // Agents with feedback rank higher
        if (a.reputation.count > 0 && b.reputation.count === 0) return -1;
        if (b.reputation.count > 0 && a.reputation.count === 0) return 1;
        return b.reputation.score - a.reputation.score;
      });

      return c.json({
        agents: discovered,
        totalScanned: scanned,
        totalRegistered: lastTokenId + 1,
        filters: { capabilities, minReputation, endpointType, limit },
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Discovery failed: ${String(error)}`, 400);
    }
  }
}
