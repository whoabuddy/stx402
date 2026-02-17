import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callAndExtractOptional,
} from "../../utils/erc8004";
import { uintCV } from "@stacks/transactions";
import {
  AGENT_WITH_ID_PARAMS,
  AGENT_ERROR_RESPONSES,
  obj,
  str,
  num,
  jsonResponse,
} from "../../utils/schema-helpers";

export class AgentOwner extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get agent owner by ID",
    parameters: AGENT_WITH_ID_PARAMS,
    responses: {
      "200": jsonResponse(
        "Agent owner",
        obj({ agentId: num, owner: str, network: str, tokenType: str })
      ),
      ...AGENT_ERROR_RESPONSES,
      "404": { description: "Agent not found" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = this.getAgentNetwork(c);

    const mainnetError = this.checkMainnetDeployment(c, network);
    if (mainnetError) return mainnetError;

    const agentIdStr = c.req.query("agentId");
    if (!agentIdStr) {
      return this.errorResponse(c, "agentId query parameter is required", 400);
    }

    const agentId = parseInt(agentIdStr, 10);
    if (isNaN(agentId) || agentId < 0) {
      return this.errorResponse(c, "agentId must be a non-negative number", 400);
    }

    try {
      // owner-of returns (optional principal)
      const { found, value: owner } = await callAndExtractOptional<string>(
        network,
        "identity",
        "owner-of",
        [uintCV(agentId)]
      );

      if (!found) {
        return this.errorResponse(c, "Agent not found", 404, { agentId });
      }

      return c.json({
        agentId,
        owner,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to fetch owner: ${String(error)}`, 400);
    }
  }
}
