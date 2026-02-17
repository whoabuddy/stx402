import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callAndExtractOptional,
} from "../../utils/erc8004";
import { principalCV } from "@stacks/transactions";
import {
  AGENT_COMMON_PARAMS,
  COMMON_ERROR_RESPONSES,
  obj,
  str,
  num,
  arr,
  jsonResponse,
} from "../../utils/schema-helpers";

export class ValidationRequests extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) List all validation requests assigned to a validator",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: obj(
            { validator: { ...str, description: "Validator principal address" } },
            ["validator"]
          ),
        },
      },
    },
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "List of validation request hashes",
        obj({
          validator: str,
          requests: { ...arr(str), description: "Request hashes (hex)" },
          count: num,
          network: str,
          tokenType: str,
        })
      ),
      ...COMMON_ERROR_RESPONSES,
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = this.getNetwork(c);

    const mainnetError = this.checkMainnetDeployment(c, network);
    if (mainnetError) return mainnetError;

    const parsed = await this.parseJsonBody<{ validator?: string }>(c);
    if (parsed.error) return parsed.error;
    const body = parsed.body;

    const { validator } = body;
    if (!validator) {
      return this.errorResponse(c, "validator principal is required", 400);
    }

    try {
      // get-validator-requests returns (optional (list buffer))
      const { found, value: listValue } = await callAndExtractOptional<{
        type: string;
        value: Array<{ type: string; value: string }>;
      }>(
        network,
        "validation",
        "get-validator-requests",
        [principalCV(validator)]
      );

      // none means no requests for this validator
      if (!found) {
        return c.json({
          validator,
          requests: [],
          count: 0,
          network,
          tokenType,
        });
      }

      const requests = listValue!.value.map((item) => item.value);

      return c.json({
        validator,
        requests,
        count: requests.length,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch validator requests: ${String(error)}`,
        400
      );
    }
  }
}
