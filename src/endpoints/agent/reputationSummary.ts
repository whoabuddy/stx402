import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  isTuple,
} from "../../utils/erc8004";
import { uintCV, principalCV, bufferCV, listCV, noneCV, someCV } from "@stacks/transactions";
import { hexToBytes } from "@noble/hashes/utils";
import { strip0x } from "../../utils/payment";
import {
  AGENT_COMMON_PARAMS,
  AGENT_ERROR_RESPONSES,
  obj,
  str,
  num,
  arr,
  jsonResponse,
} from "../../utils/schema-helpers";

export class ReputationSummary extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get reputation summary (count, average, total score)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: obj(
            {
              agentId: { ...num, description: "Agent ID" },
              filterByClients: { ...arr(str), description: "Optional: filter by specific client principals" },
              filterByTag1: { ...str, description: "Optional: filter by tag1 (hex, 32 bytes)" },
              filterByTag2: { ...str, description: "Optional: filter by tag2 (hex, 32 bytes)" },
            },
            ["agentId"]
          ),
        },
      },
    },
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "Reputation summary",
        obj({ agentId: num, count: num, averageScore: num, network: str, tokenType: str })
      ),
      ...AGENT_ERROR_RESPONSES,
      "404": { description: "Agent not found" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = this.getNetwork(c);

    const mainnetError = this.checkMainnetDeployment(c, network);
    if (mainnetError) return mainnetError;

    const parsed = await this.parseJsonBody<{
      agentId?: number;
      filterByClients?: string[];
      filterByTag1?: string;
      filterByTag2?: string;
    }>(c);
    if (parsed.error) return parsed.error;

    const { agentId, filterByClients, filterByTag1, filterByTag2 } = parsed.body;
    const agentIdError = this.validateAgentId(c, agentId);
    if (agentIdError) return agentIdError;

    try {
      // Build function arguments
      // get-summary(agent-id, opt-clients, opt-tag1, opt-tag2)
      const args = [
        uintCV(agentId),
        filterByClients && filterByClients.length > 0
          ? someCV(listCV(filterByClients.map((p) => principalCV(p))))
          : noneCV(),
        filterByTag1 ? someCV(bufferCV(hexToBytes(strip0x(filterByTag1)))) : noneCV(),
        filterByTag2 ? someCV(bufferCV(hexToBytes(strip0x(filterByTag2)))) : noneCV(),
      ];

      const result = await callRegistryFunction(
        network,
        "reputation",
        "get-summary",
        args
      );
      const json = clarityToJson(result);

      // get-summary returns a tuple directly: { count, average-score }
      // cvToJSON structure: { type: "(tuple (count uint) (average-score uint))", value: { count: { type: "uint", value: "0" }, ... } }
      if (!isTuple(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      const tuple = json as {
        type: string;
        value: {
          count: { type: string; value: string };
          "average-score": { type: string; value: string };
        };
      };

      const count = parseInt(tuple.value.count.value, 10);
      const averageScore = parseInt(tuple.value["average-score"].value, 10);

      return c.json({
        agentId,
        count,
        averageScore,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch reputation summary: ${String(error)}`,
        400
      );
    }
  }
}
