import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import type { UserDurableObject } from "../../durable-objects/UserDurableObject";

export class QueueComplete extends BaseEndpoint {
  schema = {
    tags: ["Queue"],
    summary: "(paid) Mark a job as completed",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["jobId"],
            properties: {
              jobId: {
                type: "string" as const,
                description: "Job ID returned from queue/pop",
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
        description: "Job completion status",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                completed: { type: "boolean" as const },
                jobId: { type: "string" as const },
                error: { type: "string" as const, nullable: true },
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

    let body: { jobId: string };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { jobId } = body;

    if (!jobId || typeof jobId !== "string") {
      return this.errorResponse(c, "Job ID is required", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.queueComplete(jobId);

      return c.json({
        ...result,
        jobId,
        tokenType,
      });
    } catch (error) {
      console.error("Queue complete error:", error);
      return this.errorResponse(c, `Queue operation failed: ${error}`, 500);
    }
  }
}
