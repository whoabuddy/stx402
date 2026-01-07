import { BaseEndpoint } from "../BaseEndpoint";
import { log } from "../../utils/logger";
import type { AppContext } from "../../types";

export class CounterGet extends BaseEndpoint {
  schema = {
    tags: ["Counter"],
    summary: "(paid) Get counter value and metadata",
    parameters: [
      {
        name: "name",
        in: "query" as const,
        required: true,
        schema: {
          type: "string" as const,
          description: "Counter name",
          maxLength: 64,
        },
      },
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
        description: "Counter retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                name: { type: "string" as const },
                value: { type: "number" as const },
                min: { type: "number" as const, nullable: true },
                max: { type: "number" as const, nullable: true },
                createdAt: { type: "string" as const },
                updatedAt: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid request" },
      "402": { description: "Payment required" },
      "404": { description: "Counter not found" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    const name = c.req.query("name");

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
      const result = await stub.counterGet(name);

      if (result === null) {
        return this.errorResponse(c, `Counter '${name}' not found`, 404);
      }

      return c.json({ ...result, tokenType });
    } catch (error) {
      log.error("Counter get error", { error: String(error) });
      return this.errorResponse(c, `Counter operation failed: ${error}`, 500);
    }
  }
}
