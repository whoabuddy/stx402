import { BaseEndpoint } from "../BaseEndpoint";
import { log } from "../../utils/logger";
import type { AppContext } from "../../types";

export class CounterDelete extends BaseEndpoint {
  schema = {
    tags: ["Counter"],
    summary: "(paid) Delete a counter",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["name"],
            properties: {
              name: {
                type: "string" as const,
                description: "Counter name to delete",
                maxLength: 64,
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
        description: "Counter deleted",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                deleted: { type: "boolean" as const },
                name: { type: "string" as const },
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

    let body: { name: string };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { name } = body;

    if (!name || typeof name !== "string") {
      return this.errorResponse(c, "Counter name is required", 400);
    }

    if (name.length > 64) {
      return this.errorResponse(c, "Counter name must be 64 characters or less", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.counterDelete(name);
      return c.json({ ...result, tokenType });
    } catch (error) {
      log.error("Counter delete error", { error: String(error) });
      return this.errorResponse(c, `Counter operation failed: ${error}`, 500);
    }
  }
}
