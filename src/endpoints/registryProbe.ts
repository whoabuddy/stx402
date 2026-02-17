import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { probeX402Endpoint } from "../utils/probe";
import { TOKEN_TYPE_PARAM } from "../utils/schema-helpers";

export class RegistryProbe extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Probe an x402 endpoint to discover payment requirements",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["url"],
            properties: {
              url: {
                type: "string",
                description: "The x402 endpoint URL to probe",
              },
              timeout: {
                type: "number",
                description: "Timeout in milliseconds (default: 10000)",
                default: 10000,
              },
            },
          },
        },
      },
    },
    parameters: [TOKEN_TYPE_PARAM],
    responses: {
      "200": {
        description: "Probe result",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                isX402Endpoint: { type: "boolean" },
                data: {
                  type: "object",
                  properties: {
                    paymentAddress: { type: "string" },
                    acceptedTokens: {
                      type: "array",
                      items: { type: "string" },
                    },
                    prices: {
                      type: "object",
                      additionalProperties: { type: "string" },
                    },
                    responseTimeMs: { type: "number" },
                    supportedMethods: {
                      type: "array",
                      items: { type: "string" },
                    },
                    openApiSchema: { type: "object" },
                    probeTimestamp: { type: "string" },
                  },
                },
                error: { type: "string" },
                tokenType: { type: "string" },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid request",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const { body, error } = await this.parseJsonBody<{
      url?: string;
      timeout?: number;
    }>(c);
    if (error) return error;

    if (!body.url) {
      return this.errorResponse(c, "url is required", 400);
    }

    const result = await probeX402Endpoint(body.url, {
      timeout: body.timeout,
    });

    return c.json({
      ...result,
      tokenType,
    });
  }
}
