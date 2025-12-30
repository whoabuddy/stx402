import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class ImageDescribe extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Describe image and generate tags using vision AI inference",
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          const: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        } as const,
      },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              image: {
                type: "string" as const,
                description: "Base64 encoded image (e.g., data:image/jpeg;base64,... or raw base64)",
              } as const,
              prompt: {
                type: "string" as const,
                description: "Optional custom prompt",
                default: "Describe this image in detail and list 5 relevant tags.",
              } as const,
            } as const,
          } as const,
        },
      },
    },
    responses: {
      "200": {
        description: "Image analysis result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                description: { type: "string" as const } as const,
                tags: {
                  type: "array" as const,
                  items: { type: "string" as const } as const,
                } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
      "400": {
        description: "Invalid input",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                error: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
      "402": {
        description: "Payment required",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                maxAmountRequired: { type: "string" as const } as const,
                resource: { type: "string" as const } as const,
                payTo: { type: "string" as const } as const,
                network: {
                  type: "string" as const,
                  const: ["mainnet", "testnet"] as const,
                } as const,
                nonce: { type: "string" as const } as const,
                expiresAt: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                },
              } as const,
            } as const,
          } as const,
        } as const,
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                error: { type: "string" as const } as const,
                tokenType: {
                  type: "string" as const,
                  const: ["STX", "sBTC", "USDCx"] as const,
                } as const,
              } as const,
            } as const,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body;
    try {
      body = await c.req.json<{ image: string; prompt?: string }>();
      if (!body.image || typeof body.image !== "string") {
        return this.errorResponse(c, "Missing or invalid 'image' base64 string", 400);
      }
    } catch (error) {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const prompt = body.prompt || "Describe this image in detail and list 5 relevant tags.";

    try {
      // Use Google's Gemma 3 model (no Meta license required)
      const output = await c.env.AI.run("@cf/google/gemma-3-12b-it", {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: body.image.startsWith("data:") ? body.image : `data:image/jpeg;base64,${body.image}` },
              },
            ],
          },
        ],
      });
      // Simple parse: assume model outputs "Description: ...\nTags: tag1, tag2, ..."
      const response = output.response;
      const description = response.split("\n")[0].replace("Description: ", "").trim();
      const tagsMatch = response.match(/Tags: (.*)/i);
      const tags = tagsMatch ? tagsMatch[1].split(",").map((t: string) => t.trim()).slice(0, 5) : [];

      return c.json({ description, tags, tokenType });
    } catch (error) {
      return this.errorResponse(c, `AI inference failed: ${String(error)}`, 500);
    }
  }
}
