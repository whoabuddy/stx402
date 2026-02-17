import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callAndExtractOptional,
} from "../../utils/erc8004";
import { bufferCV } from "@stacks/transactions";
import { hexToBytes } from "@noble/hashes/utils";
import {
  AGENT_COMMON_PARAMS,
  AGENT_ERROR_RESPONSES,
  obj,
  str,
  num,
  jsonResponse,
} from "../../utils/schema-helpers";

export class ValidationStatus extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get validation status by request hash",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: obj(
            { requestHash: { ...str, description: "Validation request hash (hex, 32 bytes)" } },
            ["requestHash"]
          ),
        },
      },
    },
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "Validation status",
        obj({
          requestHash: str,
          validator: str,
          agentId: num,
          score: num,
          responseHash: str,
          tag: str,
          lastUpdate: num,
          network: str,
          tokenType: str,
        })
      ),
      ...AGENT_ERROR_RESPONSES,
      "404": { description: "Validation not found" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = this.getAgentNetwork(c);

    const mainnetError = this.checkMainnetDeployment(c, network);
    if (mainnetError) return mainnetError;

    const parsed = await this.parseJsonBody<{ requestHash?: string }>(c);
    if (parsed.error) return parsed.error;
    const body = parsed.body;

    const { requestHash } = body;
    if (!requestHash) {
      return this.errorResponse(c, "requestHash is required", 400);
    }

    // Validate hex format (32 bytes = 64 hex chars)
    const cleanHash = requestHash.startsWith("0x")
      ? requestHash.slice(2)
      : requestHash;
    if (!/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
      return this.errorResponse(
        c,
        "requestHash must be 32 bytes (64 hex characters)",
        400
      );
    }

    try {
      // get-validation-status returns (optional tuple)
      const { found, value: tupleValue } = await callAndExtractOptional<{
        type: string;
        value: {
          validator: { type: string; value: string };
          "agent-id": { type: string; value: string };
          response: { type: string; value: string };
          "response-hash": { type: string; value: string };
          tag: { type: string; value: string };
          "last-update": { type: string; value: string };
        };
      }>(
        network,
        "validation",
        "get-validation-status",
        [bufferCV(hexToBytes(cleanHash))]
      );

      if (!found) {
        return this.errorResponse(c, "Validation not found", 404, {
          requestHash,
        });
      }

      if (!tupleValue) {
        return this.errorResponse(c, "Unexpected null validation response", 500);
      }

      return c.json({
        requestHash: `0x${cleanHash}`,
        validator: tupleValue.value.validator.value,
        agentId: parseInt(tupleValue.value["agent-id"].value, 10),
        score: parseInt(tupleValue.value.response.value, 10),
        responseHash: tupleValue.value["response-hash"].value,
        tag: tupleValue.value.tag.value,
        lastUpdate: parseInt(tupleValue.value["last-update"].value, 10),
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch validation status: ${String(error)}`,
        400
      );
    }
  }
}
