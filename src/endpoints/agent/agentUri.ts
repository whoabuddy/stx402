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

export class AgentUri extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get agent metadata URI by ID",
    parameters: AGENT_WITH_ID_PARAMS,
    responses: {
      "200": jsonResponse(
        "Agent URI",
        obj({ agentId: num, uri: str, network: str, tokenType: str })
      ),
      ...AGENT_ERROR_RESPONSES,
      "404": { description: "Agent not found or no URI set" },
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
      // get-uri returns (optional (string-utf8 512))
      const { found, value: uri } = await callAndExtractOptional<string>(
        network,
        "identity",
        "get-uri",
        [uintCV(agentId)]
      );

      if (!found || !uri) {
        return this.errorResponse(c, "Agent has no URI set", 404, { agentId });
      }

      return c.json({
        agentId,
        uri,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to fetch URI: ${String(error)}`, 400);
    }
  }
}
