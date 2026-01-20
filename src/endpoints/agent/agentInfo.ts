import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  extractTypedValue,
  isSome,
  isNone,
  uint,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";
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
      const ownerResult = await callRegistryFunction(
        network,
        "identity",
        "owner-of",
        [uint(agentId!)]
      );
      const ownerJson = clarityToJson(ownerResult);

      // owner-of returns (optional principal): some = exists, none = not found
      if (isNone(ownerJson)) {
        return this.errorResponse(c, "Agent not found", 404, { agentId });
      }

      if (!isSome(ownerJson)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      // Extract: { type: "some", value: { type: "principal", value: "SP..." } }
      const ownerValue = extractValue(ownerJson); // { type: "principal", value: "SP..." }
      const owner = extractTypedValue(ownerValue) as string;

      // Fetch URI - returns (optional (string-utf8 512))
      const uriResult = await callRegistryFunction(
        network,
        "identity",
        "get-uri",
        [uint(agentId!)]
      );
      const uriJson = clarityToJson(uriResult);
      let uri: string | null = null;
      if (isSome(uriJson)) {
        const uriValue = extractValue(uriJson);
        uri = extractTypedValue(uriValue) as string;
      }

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
