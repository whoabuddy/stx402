import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import type { UserDurableObject } from "../../durable-objects/UserDurableObject";

export class QueueStatus extends BaseEndpoint {
  schema = {
    tags: ["Queue"],
    summary: "(paid) Get queue statistics",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["queue"],
            properties: {
              queue: {
                type: "string" as const,
                description: "Queue name",
                minLength: 1,
                maxLength: 128,
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
        description: "Queue statistics",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                queue: { type: "string" as const },
                pending: { type: "number" as const },
                processing: { type: "number" as const },
                completed: { type: "number" as const },
                failed: { type: "number" as const },
                dead: { type: "number" as const },
                total: { type: "number" as const },
                oldestPending: { type: "string" as const, nullable: true },
                newestPending: { type: "string" as const, nullable: true },
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

    let body: { queue: string };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { queue } = body;

    if (!queue || typeof queue !== "string") {
      return this.errorResponse(c, "Queue name is required", 400);
    }

    if (queue.length > 128) {
      return this.errorResponse(c, "Queue name must be 128 characters or less", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.queueStatus(queue);

      return c.json({
        ...result,
        tokenType,
      });
    } catch (error) {
      console.error("Queue status error:", error);
      return this.errorResponse(c, `Queue operation failed: ${error}`, 500);
    }
  }
}
