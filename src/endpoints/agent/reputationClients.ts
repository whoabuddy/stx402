import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  isSome,
  isNone,
  uint,
} from "../../utils/erc8004";
import {
  AGENT_COMMON_PARAMS,
  AGENT_ID_BODY_SCHEMA,
  AGENT_ERROR_RESPONSES,
  obj,
  str,
  num,
  arr,
  jsonResponse,
} from "../../utils/schema-helpers";

export class ReputationClients extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get all clients who gave feedback to agent",
    requestBody: AGENT_ID_BODY_SCHEMA,
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "List of client principals",
        obj({ agentId: num, clients: arr(str), count: num, network: str, tokenType: str })
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

    const parsed = await this.parseJsonBody<{ agentId?: number }>(c);
    if (parsed.error) return parsed.error;

    const { agentId } = parsed.body;
    const agentIdError = this.validateAgentId(c, agentId);
    if (agentIdError) return agentIdError;

    try {
      // get-clients returns (optional (list principal))
      const result = await callRegistryFunction(
        network,
        "reputation",
        "get-clients",
        [uint(agentId)]
      );
      const json = clarityToJson(result);

      // none means no clients yet (or agent doesn't exist in reputation registry)
      if (isNone(json)) {
        return c.json({
          agentId,
          clients: [],
          count: 0,
          network,
          tokenType,
        });
      }

      if (!isSome(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      // Extract: { type: "some", value: { type: "list", value: [...] } }
      const listValue = extractValue(json) as {
        type: string;
        value: Array<{ type: string; value: string }>;
      };

      const clients = listValue.value.map((item) => item.value);

      return c.json({
        agentId,
        clients,
        count: clients.length,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch clients: ${String(error)}`,
        400
      );
    }
  }
}
