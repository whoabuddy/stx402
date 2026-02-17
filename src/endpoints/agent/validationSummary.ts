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

export class ValidationSummary extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get validation summary for agent",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: obj(
            {
              agentId: { ...num, description: "Agent ID" },
              filterByValidators: { ...arr(str), description: "Optional: filter by specific validator principals" },
              filterByTag: { ...str, description: "Optional: filter by tag (hex, 32 bytes)" },
            },
            ["agentId"]
          ),
        },
      },
    },
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "Validation summary",
        obj({ agentId: num, count: num, averageResponse: num, network: str, tokenType: str })
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
      filterByValidators?: string[];
      filterByTag?: string;
    }>(c);
    if (parsed.error) return parsed.error;

    const { agentId, filterByValidators, filterByTag } = parsed.body;
    const agentIdError = this.validateAgentId(c, agentId);
    if (agentIdError) return agentIdError;

    try {
      // get-summary(agent-id, opt-validators, opt-tag)
      const args = [
        uintCV(agentId),
        filterByValidators && filterByValidators.length > 0
          ? someCV(listCV(filterByValidators.map((p) => principalCV(p))))
          : noneCV(),
        filterByTag ? someCV(bufferCV(hexToBytes(strip0x(filterByTag)))) : noneCV(),
      ];

      const result = await callRegistryFunction(
        network,
        "validation",
        "get-summary",
        args
      );
      const json = clarityToJson(result);

      // get-summary returns a tuple directly: { count, avg-response }
      // cvToJSON structure: { type: "(tuple ...)", value: { ... } }
      if (!isTuple(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      const tuple = json as {
        type: string;
        value: {
          count: { type: string; value: string };
          "avg-response": { type: string; value: string };
        };
      };

      const count = parseInt(tuple.value.count.value, 10);
      const averageResponse = parseInt(tuple.value["avg-response"].value, 10);

      return c.json({
        agentId,
        count,
        averageResponse,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch validation summary: ${String(error)}`,
        400
      );
    }
  }
}
