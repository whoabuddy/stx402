import { OpenAPIRoute } from "chanfana";
import { validateStacksAddress } from "@stacks/transactions";
import type { AppContext } from "../types";

export class ValidateStacksAddress extends OpenAPIRoute {
  schema = {
    tags: ["Stacks"],
    summary: "Validate a Stacks address",
    parameters: [
      {
        name: "address",
        in: "path" as const,
        required: true,
        schema: { type: "string", example: "SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF" },
      },
    ],
    responses: {
      "200": {
        description: "Valid Stacks address",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                valid: { type: "boolean", const: true },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid Stacks address",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                valid: { type: "boolean", const: false },
                error: { type: "string" },
              },
            },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const address = c.req.param("address");
    if (validateStacksAddress(address)) {
      return { valid: true };
    }
    return c.json({ valid: false, error: "Invalid Stacks address" }, 400);
  }
}
