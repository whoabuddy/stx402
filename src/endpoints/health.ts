import { OpenAPIRoute } from "chanfana";
import z from "zod";
import { type AppContext } from "../types";

export class Health extends OpenAPIRoute {
  schema = {
    tags: ["Health"],
    summary: "Check the stx402 service health",
    request: {},
    responses: {
      "200": {
        description: "Service health status",
        content: {
          "application/json": {
            schema: z.object({
              status: z.literal("ok"),
              details: z.object({
                timestamp: z.string(),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    return {
      status: "ok",
      details: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
