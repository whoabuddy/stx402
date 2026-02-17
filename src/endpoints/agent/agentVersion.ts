import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callAndExtractDirect,
  extractTypedValue,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";
import {
  AGENT_COMMON_PARAMS,
  COMMON_ERROR_RESPONSES,
  obj,
  str,
  jsonResponse,
} from "../../utils/schema-helpers";

export class AgentVersion extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get identity registry version",
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "Registry version",
        obj({ version: str, registry: str, contractId: str, network: str, tokenType: str })
      ),
      ...COMMON_ERROR_RESPONSES,
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = this.getAgentNetwork(c);

    const mainnetError = this.checkMainnetDeployment(c, network);
    if (mainnetError) return mainnetError;

    try {
      // get-version returns (string-utf8 5) directly, not wrapped in (ok ...)
      const json = await callAndExtractDirect(
        network,
        "identity",
        "get-version",
        []
      );

      // Result is { type: "string-utf8", value: "1.0.0" }
      const version = extractTypedValue(json) as string;
      const contracts = ERC8004_CONTRACTS[network]!;

      return c.json({
        version,
        registry: "identity",
        contractId: contracts.identity,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch version: ${String(error)}`,
        400
      );
    }
  }
}
