import { OpenAPIRoute } from "chanfana";
import { validateStacksAddress } from "@stacks/transactions";
import { getNameFromAddress } from "../utils/bns";
import type { AppContext } from "../types";

export class GetBnsName extends OpenAPIRoute {
  schema = {
    tags: ["BNS"],
    summary: "Get primary BNSV2 name for Stacks address",
    parameters: [
      {
        name: "address",
        in: "path",
        required: true,
        schema: {
          type: "string",
          example: "SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF",
        },
      },
    ],
    responses: {
      "200": {
        description: "BNS name",
        content: {
          "text/plain": {
            schema: { type: "string", example: "stacks.btc" },
          },
        },
      },
      "400": { description: "Invalid address" },
      "404": { description: "No name found" },
      "500": { description: "Fetch error" },
    },
  };

  async handle(c: AppContext) {
    const address = c.req.param("address");
    if (!validateStacksAddress(address)) {
      return c.json({ error: "Invalid Stacks address" }, 400);
    }

    try {
      const name = await getNameFromAddress(address);
      if (!name) {
        return c.json({ error: "No BNS name found" }, 404);
      }
      return name; // Plain text 200
    } catch (error) {
      return c.json({ error: "Internal server error" }, 500);
    }
  }
}
