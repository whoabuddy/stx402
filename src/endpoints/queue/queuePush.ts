import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class QueuePush extends BaseEndpoint {
  schema = {
    tags: ["Queue"],
    summary: "(paid) Add a job to a queue",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["queue", "payload"],
            properties: {
              queue: {
                type: "string" as const,
                description: "Queue name",
                minLength: 1,
                maxLength: 128,
              },
              payload: {
                description: "Job data (any JSON value)",
              },
              priority: {
                type: "number" as const,
                description: "Job priority (higher = processed sooner, default 0)",
                default: 0,
              },
              delay: {
                type: "number" as const,
                description: "Seconds to wait before job becomes available (default 0)",
                minimum: 0,
                maximum: 86400,
                default: 0,
              },
              maxAttempts: {
                type: "number" as const,
                description: "Maximum retry attempts (default 3)",
                minimum: 1,
                maximum: 10,
                default: 3,
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
        description: "Job added to queue",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                jobId: { type: "string" as const },
                queue: { type: "string" as const },
                position: { type: "number" as const },
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

    let body: {
      queue: string;
      payload: unknown;
      priority?: number;
      delay?: number;
      maxAttempts?: number;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { queue, payload, priority, delay, maxAttempts } = body;

    if (!queue || typeof queue !== "string") {
      return this.errorResponse(c, "Queue name is required", 400);
    }

    if (queue.length > 128) {
      return this.errorResponse(c, "Queue name must be 128 characters or less", 400);
    }

    if (payload === undefined) {
      return this.errorResponse(c, "Payload is required", 400);
    }

    // Validate optional parameters
    if (delay !== undefined && (delay < 0 || delay > 86400)) {
      return this.errorResponse(c, "Delay must be between 0 and 86400 seconds", 400);
    }

    if (maxAttempts !== undefined && (maxAttempts < 1 || maxAttempts > 10)) {
      return this.errorResponse(c, "maxAttempts must be between 1 and 10", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.queuePush(queue, payload, {
        priority,
        delay,
        maxAttempts,
      });

      return c.json({
        ...result,
        tokenType,
      });
    } catch (error) {
      c.var.logger.error("Queue push error", { error: String(error) });
      return this.errorResponse(c, `Queue operation failed: ${error}`, 500);
    }
  }
}
