import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  isList,
  boolCV,
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
  bool,
  arr,
  jsonResponse,
} from "../../utils/schema-helpers";

export class ReputationList extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) List all feedback for agent (max 50 results)",
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
              includeRevoked: { ...bool, description: "Include revoked feedback (default: false)", default: false },
            },
            ["agentId"]
          ),
        },
      },
    },
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "List of feedback entries",
        obj({
          agentId: num,
          feedback: arr(obj({ client: str, index: num, score: num, tag1: str, tag2: str, isRevoked: bool })),
          count: num,
          network: str,
          tokenType: str,
        })
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
      includeRevoked?: boolean;
    }>(c);
    if (parsed.error) return parsed.error;

    const {
      agentId,
      filterByClients,
      filterByTag1,
      filterByTag2,
      includeRevoked = false,
    } = parsed.body;

    const agentIdError = this.validateAgentId(c, agentId);
    if (agentIdError) return agentIdError;

    try {
      // read-all-feedback(agent-id, opt-clients, opt-tag1, opt-tag2, include-revoked)
      // Returns a list directly, not wrapped in (ok ...)
      const args = [
        uintCV(agentId),
        filterByClients && filterByClients.length > 0
          ? someCV(listCV(filterByClients.map((p) => principalCV(p))))
          : noneCV(),
        filterByTag1 ? someCV(bufferCV(hexToBytes(strip0x(filterByTag1)))) : noneCV(),
        filterByTag2 ? someCV(bufferCV(hexToBytes(strip0x(filterByTag2)))) : noneCV(),
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
