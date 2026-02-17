import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callAndExtractOptional,
} from "../../utils/erc8004";
import { uintCV, principalCV } from "@stacks/transactions";
import {
  AGENT_COMMON_PARAMS,
  AGENT_ERROR_RESPONSES,
  obj,
  str,
  num,
  bool,
  jsonResponse,
} from "../../utils/schema-helpers";

export class ReputationFeedback extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get specific feedback entry",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: obj(
            {
              agentId: { ...num, description: "Agent ID" },
              client: { ...str, description: "Client principal who gave feedback" },
              index: { ...num, description: "Feedback index (0-based)" },
            },
            ["agentId", "client", "index"]
          ),
        },
      },
    },
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "Feedback entry",
        obj({
          agentId: num,
          client: str,
          index: num,
          score: num,
          tag1: str,
          tag2: str,
          isRevoked: bool,
          network: str,
          tokenType: str,
        })
      ),
      ...AGENT_ERROR_RESPONSES,
      "404": { description: "Feedback not found" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = this.getAgentNetwork(c);

    const mainnetError = this.checkMainnetDeployment(c, network);
    if (mainnetError) return mainnetError;

    const parsed = await this.parseJsonBody<{ agentId?: number; client?: string; index?: number }>(c);
    if (parsed.error) return parsed.error;

    const { agentId, client, index } = parsed.body;
    const agentIdError = this.validateAgentId(c, agentId);
    if (agentIdError) return agentIdError;
    if (!client) {
      return this.errorResponse(c, "client principal is required", 400);
    }
    if (index === undefined || index < 0) {
      return this.errorResponse(c, "index is required and must be >= 0", 400);
    }

    try {
      // read-feedback returns (optional tuple)
      const { found, value: tupleValue } = await callAndExtractOptional<{
        type: string;
        value: {
          score: { type: string; value: string };
          tag1: { type: string; value: string };
          tag2: { type: string; value: string };
          "is-revoked": { type: string; value: boolean };
        };
      }>(
        network,
        "reputation",
        "read-feedback",
        [uintCV(agentId), principalCV(client), uintCV(index)]
      );

      if (!found) {
        return this.errorResponse(c, "Feedback not found", 404, {
          agentId,
          client,
          index,
        });
      }

      if (!tupleValue) {
        return this.errorResponse(c, "Unexpected null feedback response", 500);
      }

      return c.json({
        agentId,
        client,
        index,
        score: parseInt(tupleValue.value.score.value, 10),
        tag1: tupleValue.value.tag1.value,
        tag2: tupleValue.value.tag2.value,
        isRevoked: tupleValue.value["is-revoked"].value,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch feedback: ${String(error)}`,
        400
      );
    }
  }
}
