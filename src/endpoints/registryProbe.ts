import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import { probeX402Endpoint } from "../utils/probe";

export class RegistryProbe extends BaseEndpoint {
  schema = {
    tags: ["Registry"],
    summary: "(paid) Probe an x402 endpoint to discover payment requirements",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["url"],
            properties: {
              url: {
                type: "string" as const,
                description: "The x402 endpoint URL to probe",
              },
              timeout: {
                type: "number" as const,
                description: "Timeout in milliseconds (default: 10000)",
                default: 10000,
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "Probe result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                isX402Endpoint: { type: "boolean" as const },
                data: {
                  type: "object" as const,
                  properties: {
                    paymentAddress: { type: "string" as const },
                    acceptedTokens: {
                      type: "array" as const,
                      items: { type: "string" as const },
                    },
                    prices: {
                      type: "object" as const,
                      additionalProperties: { type: "string" as const },
                    },
                    responseTimeMs: { type: "number" as const },
                    supportedMethods: {
                      type: "array" as const,
                      items: { type: "string" as const },
                    },
                    openApiSchema: { type: "object" as const },
                    probeTimestamp: { type: "string" as const },
                  },
                },
                error: { type: "string" as const },
                tokenType: { type: "string" as const },
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

    let body: { url?: string; timeout?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

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
