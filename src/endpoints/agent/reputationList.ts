import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  isList,
  uint,
  principal,
  buffer,
  list,
  none,
  some,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class ReputationList extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) List all feedback for agent (max 50 results)",
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
                description: "Agent ID",
              },
              filterByClients: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "Optional: filter by specific client principals",
              },
              filterByTag1: {
                type: "string" as const,
                description: "Optional: filter by tag1 (hex, 32 bytes)",
              },
              filterByTag2: {
                type: "string" as const,
                description: "Optional: filter by tag2 (hex, 32 bytes)",
              },
              includeRevoked: {
                type: "boolean" as const,
                description: "Include revoked feedback (default: false)",
                default: false,
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
        description: "List of feedback entries",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agentId: { type: "number" as const },
                feedback: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      client: { type: "string" as const },
                      index: { type: "number" as const },
                      score: { type: "number" as const },
                      tag1: { type: "string" as const },
                      tag2: { type: "string" as const },
                      isRevoked: { type: "boolean" as const },
                    },
                  },
                },
                count: { type: "number" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
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
      return this.errorResponse(
        c,
        "ERC-8004 contracts not yet deployed on mainnet",
        501
      );
    }

    let body: {
      agentId?: number;
      filterByClients?: string[];
      filterByTag1?: string;
      filterByTag2?: string;
      includeRevoked?: boolean;
    };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const {
      agentId,
      filterByClients,
      filterByTag1,
      filterByTag2,
      includeRevoked = false,
    } = body;

    if (agentId === undefined || agentId < 0) {
      return this.errorResponse(c, "agentId is required and must be >= 0", 400);
    }

    try {
      // read-all-feedback(agent-id, opt-clients, opt-tag1, opt-tag2, include-revoked)
      // Returns a list directly, not wrapped in (ok ...)
      const args = [
        uint(agentId),
        filterByClients && filterByClients.length > 0
          ? some(list(filterByClients.map((p) => principal(p))))
          : none(),
        filterByTag1 ? some(buffer(filterByTag1)) : none(),
        filterByTag2 ? some(buffer(filterByTag2)) : none(),
        boolCV(includeRevoked),
      ];

      const result = await callRegistryFunction(
        network,
        "reputation",
        "read-all-feedback",
        args
      );
      const json = clarityToJson(result);

      // Result is { type: "(list ...)", value: [...] }
      if (!isList(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      const listResult = json as {
        type: string;
        value: Array<{
          type: string;
          value: {
            client: { type: string; value: string };
            index: { type: string; value: string };
            score: { type: string; value: string };
            tag1: { type: string; value: string };
            tag2: { type: string; value: string };
            "is-revoked": { type: string; value: boolean };
          };
        }>;
      };

      const feedback = listResult.value.map((item) => ({
        client: item.value.client.value,
        index: parseInt(item.value.index.value, 10),
        score: parseInt(item.value.score.value, 10),
        tag1: item.value.tag1.value,
        tag2: item.value.tag2.value,
        isRevoked: item.value["is-revoked"].value,
      }));

      return c.json({
        agentId,
        feedback,
        count: feedback.length,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch feedback list: ${String(error)}`,
        400
      );
    }
  }
}
