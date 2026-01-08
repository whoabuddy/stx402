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
  isList,
  uint,
  principal,
  list,
  stringUtf8,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

// Agent Registration File structure (from ERC-8004 spec)
interface AgentRegistrationFile {
  name?: string;
  description?: string;
  endpoints?: {
    mcp?: string[];
    a2a?: string[];
    http?: string[];
  };
  capabilities?: string[];
  trust_models?: string[];
  version?: string;
}

// Trust level thresholds
const TRUST_LEVELS = {
  EXCELLENT: { min: 80, label: "Excellent" },
  GOOD: { min: 60, label: "Good" },
  MODERATE: { min: 40, label: "Moderate" },
  LOW: { min: 20, label: "Low" },
  UNKNOWN: { min: 0, label: "Unknown" },
} as const;

// Calculate trust level from score
function getTrustLevel(score: number): string {
  if (score >= TRUST_LEVELS.EXCELLENT.min) return TRUST_LEVELS.EXCELLENT.label;
  if (score >= TRUST_LEVELS.GOOD.min) return TRUST_LEVELS.GOOD.label;
  if (score >= TRUST_LEVELS.MODERATE.min) return TRUST_LEVELS.MODERATE.label;
  if (score >= TRUST_LEVELS.LOW.min) return TRUST_LEVELS.LOW.label;
  return TRUST_LEVELS.UNKNOWN.label;
}

// Fetch and parse agent registration file from URI
async function fetchAgentRegistrationFile(uri: string): Promise<AgentRegistrationFile | null> {
  if (!uri) return null;

  try {
    // Handle IPFS URIs
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
      fetchUrl = `https://ipfs.io/ipfs/${uri.slice(7)}`;
    }

    const res = await fetch(fetchUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) return null;

    const data = await res.json() as AgentRegistrationFile;
    return data;
  } catch {
    return null;
  }
}

// Generate insights based on agent data
function generateInsights(data: {
  hasUri: boolean;
  registrationFile: AgentRegistrationFile | null;
  reputationScore: number;
  feedbackCount: number;
  validationScore: number;
  validationCount: number;
}): Array<{ type: string; title: string; description: string }> {
  const insights: Array<{ type: string; title: string; description: string }> = [];

  // No registration file
  if (!data.hasUri) {
    insights.push({
      type: "warning",
      title: "No Registration File",
      description: "Agent has no URI set - identity cannot be verified via off-chain metadata",
    });
  } else if (!data.registrationFile) {
    insights.push({
      type: "warning",
      title: "Registration File Unavailable",
      description: "Agent's registration file could not be fetched or parsed",
    });
  }

  // No endpoints defined
  if (data.registrationFile && !data.registrationFile.endpoints) {
    insights.push({
      type: "info",
      title: "No Endpoints Defined",
      description: "Agent has not published any service endpoints",
    });
  }

  // Reputation insights
  if (data.feedbackCount === 0) {
    insights.push({
      type: "info",
      title: "New Agent",
      description: "No reputation feedback yet - this is an unproven agent",
    });
  } else if (data.reputationScore < 40 && data.feedbackCount >= 3) {
    insights.push({
      type: "risk",
      title: "Low Reputation",
      description: `Average score of ${data.reputationScore}/100 from ${data.feedbackCount} reviews`,
    });
  } else if (data.reputationScore >= 80 && data.feedbackCount >= 5) {
    insights.push({
      type: "positive",
      title: "Highly Rated",
      description: `Excellent reputation with ${data.reputationScore}/100 from ${data.feedbackCount} reviews`,
    });
  }

  // Validation insights
  if (data.validationCount === 0) {
    insights.push({
      type: "info",
      title: "No Validations",
      description: "Agent has not requested third-party validation of work",
    });
  } else if (data.validationScore >= 80 && data.validationCount >= 3) {
    insights.push({
      type: "positive",
      title: "Validated Performance",
      description: `${data.validationCount} successful validations with ${data.validationScore}/100 average`,
    });
  }

  return insights;
}

export class AgentProfile extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Full agent intelligence profile",
    description: "Comprehensive agent report combining identity, reputation, validation, and off-chain metadata with trust scoring and insights",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["agentId"],
            properties: {
              agentId: {
                type: "number" as const,
                description: "Agent ID to profile",
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
        description: "Stacks network to query",
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
        description: "Agent intelligence profile",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agentId: { type: "number" as const },
                globalId: { type: "string" as const },
                identity: { type: "object" as const },
                registrationFile: { type: "object" as const, nullable: true },
                reputation: { type: "object" as const },
                validation: { type: "object" as const },
                trustScore: { type: "number" as const },
                trustLevel: { type: "string" as const },
                insights: { type: "array" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "404": { description: "Agent not found" },
      "501": { description: "Network not supported" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = (c.req.query("network") || "testnet") as ERC8004Network;

    if (network === "mainnet" && !ERC8004_CONTRACTS.mainnet) {
      return this.errorResponse(c, "ERC-8004 contracts not yet deployed on mainnet", 501);
    }

    let body: { agentId?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { agentId } = body;
    if (agentId === undefined || agentId < 0) {
      return this.errorResponse(c, "agentId is required and must be >= 0", 400);
    }

    try {
      // Fetch all data in parallel
      const [ownerResult, uriResult, metadataResult, reputationResult, validationResult] = await Promise.all([
        // Identity: owner
        callRegistryFunction(network, "identity", "owner-of", [uint(agentId)]),
        // Identity: URI
        callRegistryFunction(network, "identity", "get-uri", [uint(agentId)]),
        // Identity: metadata
        callRegistryFunction(network, "identity", "get-metadata", [uint(agentId)]),
        // Reputation: summary (all clients, no tag filter)
        callRegistryFunction(network, "reputation", "get-summary", [
          uint(agentId),
          list([]),
          stringUtf8(""),
          stringUtf8(""),
        ]),
        // Validation: summary (all validators, no tag filter)
        callRegistryFunction(network, "validation", "get-summary", [
          uint(agentId),
          list([]),
          stringUtf8(""),
        ]),
      ]);

      // Parse owner
      const ownerJson = clarityToJson(ownerResult);
      if (isNone(ownerJson)) {
        return this.errorResponse(c, "Agent not found", 404, { agentId });
      }
      const owner = extractTypedValue(extractValue(ownerJson)) as string;

      // Parse URI
      const uriJson = clarityToJson(uriResult);
      let uri: string | null = null;
      if (isSome(uriJson)) {
        uri = extractTypedValue(extractValue(uriJson)) as string;
      }

      // Parse metadata
      const metadataJson = clarityToJson(metadataResult);
      let metadata: Record<string, string> = {};
      if (isSome(metadataJson)) {
        const metaValue = extractValue(metadataJson);
        if (isList(metaValue)) {
          const items = (metaValue as { value: Array<{ value: { key: { value: string }; value: { value: string } } }> }).value;
          for (const item of items) {
            if (item.value?.key?.value && item.value?.value?.value) {
              metadata[item.value.key.value] = item.value.value.value;
            }
          }
        }
      }

      // Parse reputation summary: { count: uint, average-score: uint }
      const repJson = clarityToJson(reputationResult);
      let reputationCount = 0;
      let reputationScore = 0;
      if (isTuple(repJson)) {
        const repValue = repJson as { value: { count?: { value: string }; "average-score"?: { value: string } } };
        reputationCount = parseInt(repValue.value?.count?.value || "0", 10);
        reputationScore = parseInt(repValue.value?.["average-score"]?.value || "0", 10);
      }

      // Parse validation summary: { count: uint, average-response: uint }
      const valJson = clarityToJson(validationResult);
      let validationCount = 0;
      let validationScore = 0;
      if (isTuple(valJson)) {
        const valValue = valJson as { value: { count?: { value: string }; "average-response"?: { value: string } } };
        validationCount = parseInt(valValue.value?.count?.value || "0", 10);
        validationScore = parseInt(valValue.value?.["average-response"]?.value || "0", 10);
      }

      // Fetch registration file from URI
      const registrationFile = uri ? await fetchAgentRegistrationFile(uri) : null;

      // Calculate composite trust score
      // Weighted: 50% reputation, 30% validation, 20% metadata completeness
      let trustScore = 50; // Base score for existing agent

      if (reputationCount > 0) {
        trustScore += (reputationScore / 100) * 30; // Up to 30 points from reputation
      }
      if (validationCount > 0) {
        trustScore += (validationScore / 100) * 15; // Up to 15 points from validation
      }
      if (uri && registrationFile) {
        trustScore += 5; // 5 points for having valid registration file
        if (registrationFile.endpoints) {
          trustScore += 5; // 5 more for having endpoints defined
        }
      }

      trustScore = Math.min(Math.round(trustScore), 100);
      const trustLevel = getTrustLevel(trustScore);

      // Generate insights
      const insights = generateInsights({
        hasUri: !!uri,
        registrationFile,
        reputationScore,
        feedbackCount: reputationCount,
        validationScore,
        validationCount,
      });

      // Build global identifier (CAIP-2 format)
      const chainId = network === "mainnet" ? 1 : 2147483648;
      const contracts = ERC8004_CONTRACTS[network]!;
      const globalId = `stacks:${chainId}:${contracts.identity}:${agentId}`;

      return c.json({
        agentId,
        globalId,
        timestamp: new Date().toISOString(),
        identity: {
          owner,
          uri,
          metadata,
          contractId: contracts.identity,
        },
        registrationFile,
        reputation: {
          feedbackCount: reputationCount,
          averageScore: reputationScore,
          scoreLabel: getTrustLevel(reputationScore),
          contractId: contracts.reputation,
        },
        validation: {
          validationCount,
          averageResponse: validationScore,
          responseLabel: getTrustLevel(validationScore),
          contractId: contracts.validation,
        },
        trustScore,
        trustLevel,
        insights,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to fetch agent profile: ${String(error)}`, 400);
    }
  }
}
