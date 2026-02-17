import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callAndExtractOptional,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";
import { uintCV } from "@stacks/transactions";
import {
  AGENT_COMMON_PARAMS,
  AGENT_ID_BODY_SCHEMA,
  AGENT_ERROR_RESPONSES,
  obj,
  str,
  num,
  jsonResponse,
} from "../../utils/schema-helpers";

export class AgentInfo extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get full agent info (owner, URI)",
    requestBody: AGENT_ID_BODY_SCHEMA,
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "Agent info",
        obj({ agentId: num, owner: str, uri: str, network: str, contractId: str, tokenType: str })
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
      // Fetch owner - returns (optional principal)
      const { found, value: owner } = await callAndExtractOptional<string>(
        network,
        "identity",
        "owner-of",
        [uintCV(agentId!)]
      );

      // owner-of returns (optional principal): some = exists, none = not found
      if (!found) {
        return this.errorResponse(c, "Agent not found", 404, { agentId });
      }

      // Fetch URI - returns (optional (string-utf8 512))
      const { value: uri } = await callAndExtractOptional<string>(
        network,
        "identity",
        "get-uri",
        [uintCV(agentId!)]
      );

      const contracts = ERC8004_CONTRACTS[network]!;

      return c.json({
        agentId,
        owner,
        uri,
        network,
        contractId: contracts.identity,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch agent info: ${String(error)}`,
        400
      );
    }
  }
}
