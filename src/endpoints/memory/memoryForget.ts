import { BaseEndpoint } from "../BaseEndpoint";
import { log } from "../../utils/logger";
import type { AppContext } from "../../types";

export class MemoryForget extends BaseEndpoint {
  schema = {
    tags: ["Memory"],
    summary: "(paid) Delete a memory by key",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["key"],
            properties: {
              key: {
                type: "string" as const,
                description: "Memory key to delete",
                minLength: 1,
                maxLength: 256,
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
        description: "Memory deleted",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                deleted: { type: "boolean" as const },
                key: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid request" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    let body: { key: string };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { key } = body;

    if (!key || typeof key !== "string") {
      return this.errorResponse(c, "Key is required", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.memoryForget(key);

      return c.json({
        ...result,
        tokenType,
      });
    } catch (error) {
      log.error("Memory forget error", { error: String(error) });
      return this.errorResponse(c, `Memory operation failed: ${error}`, 500);
    }
  }
}
