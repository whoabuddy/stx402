import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  extractTypedValue,
  isSome,
  isNone,
} from "../../utils/erc8004";
import { uintCV, stringUtf8CV } from "@stacks/transactions";
import {
  AGENT_COMMON_PARAMS,
  AGENT_ERROR_RESPONSES,
  obj,
  str,
  num,
  jsonResponse,
} from "../../utils/schema-helpers";

export class AgentMetadata extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get specific metadata key for agent",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: obj(
            {
              agentId: { ...num, description: "Agent ID" },
              key: { ...str, description: "Metadata key (max 128 UTF-8 chars)", maxLength: 128 },
            },
            ["agentId", "key"]
          ),
        },
      },
    },
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "Metadata value",
        obj({ agentId: num, key: str, value: str, valueHex: str, network: str, tokenType: str })
      ),
      ...AGENT_ERROR_RESPONSES,
      "404": { description: "Agent or key not found" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = this.getNetwork(c);

    const mainnetError = this.checkMainnetDeployment(c, network);
    if (mainnetError) return mainnetError;

    const parsed = await this.parseJsonBody<{ agentId?: number; key?: string }>(c);
    if (parsed.error) return parsed.error;

    const { agentId, key } = parsed.body;
    const agentIdError = this.validateAgentId(c, agentId);
    if (agentIdError) return agentIdError;
    if (!key || key.length > 128) {
      return this.errorResponse(
        c,
        "key is required and must be <= 128 characters",
        400
      );
    }

    try {
      // get-metadata returns (optional (buffer 512))
      const result = await callRegistryFunction(
        network,
        "identity",
        "get-metadata",
        [uintCV(agentId), stringUtf8CV(key)]
      );
      const json = clarityToJson(result);

      if (isNone(json)) {
        return this.errorResponse(c, "Metadata key not found", 404, {
          agentId,
          key,
        });
      }

      if (!isSome(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      // Extract buffer value
      const bufferValue = extractValue(json);
      const valueHex = extractTypedValue(bufferValue) as string;

      // Try to decode as UTF-8 text
      let valueText = "";
      try {
        const cleanHex = valueHex.startsWith("0x") ? valueHex.slice(2) : valueHex;
        const bytes = new Uint8Array(
          cleanHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []
        );
        valueText = new TextDecoder().decode(bytes);
      } catch {
        valueText = valueHex;
      }

      return c.json({
        agentId,
        key,
        value: valueText,
        valueHex,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch metadata: ${String(error)}`,
        400
      );
    }
  }
}
