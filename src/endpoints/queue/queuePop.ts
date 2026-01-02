import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import type { UserDurableObject } from "../../durable-objects/UserDurableObject";

export class QueuePop extends BaseEndpoint {
  schema = {
    tags: ["Queue"],
    summary: "(paid) Claim the next job from a queue",
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
              visibility: {
                type: "number" as const,
                description: "Seconds before job becomes available again if not completed (default 60)",
                minimum: 10,
                maximum: 3600,
                default: 60,
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
        description: "Job claimed or empty queue",
        content: {
          "application/json": {
            schema: {
              oneOf: [
                {
                  type: "object" as const,
                  properties: {
                    jobId: { type: "string" as const },
                    payload: {},
                    attempt: { type: "number" as const },
                    tokenType: { type: "string" as const },
                  },
                },
                {
                  type: "object" as const,
                  properties: {
                    empty: { type: "boolean" as const },
                    tokenType: { type: "string" as const },
                  },
                },
              ],
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

    let body: { queue: string; visibility?: number };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { queue, visibility } = body;

    if (!queue || typeof queue !== "string") {
      return this.errorResponse(c, "Queue name is required", 400);
    }

    if (queue.length > 128) {
      return this.errorResponse(c, "Queue name must be 128 characters or less", 400);
    }

    // Validate visibility if provided
    if (visibility !== undefined && (visibility < 10 || visibility > 3600)) {
      return this.errorResponse(c, "Visibility must be between 10 and 3600 seconds", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.queuePop(queue, { visibility });

      return c.json({
        ...result,
        tokenType,
      });
    } catch (error) {
      console.error("Queue pop error:", error);
      return this.errorResponse(c, `Queue operation failed: ${error}`, 500);
    }
  }
}
