import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";

export class QueueFail extends BaseEndpoint {
  schema = {
    tags: ["Queue"],
    summary: "(paid) Mark a job as failed (will retry or go to dead letter)",
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
              error: {
                type: "string" as const,
                description: "Error message to store with the job",
              },
              retry: {
                type: "boolean" as const,
                description: "Whether to retry (default true if attempts remain)",
                default: true,
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
        description: "Job failure status",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                failed: { type: "boolean" as const },
                willRetry: { type: "boolean" as const },
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

    let body: { jobId: string; error?: string; retry?: boolean };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { jobId, error, retry } = body;

    if (!jobId || typeof jobId !== "string") {
      return this.errorResponse(c, "Job ID is required", 400);
    }

    // Get user's Durable Object
    const id = c.env.USER_DO.idFromName(payerAddress);
    const stub = c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;

    try {
      const result = await stub.queueFail(jobId, { error, retry });

      return c.json({
        ...result,
        jobId,
        tokenType,
      });
    } catch (err) {
      c.var.logger.error("Queue fail error", { error: String(err) });
      return this.errorResponse(c, `Queue operation failed: ${err}`, 500);
    }
  }
}
