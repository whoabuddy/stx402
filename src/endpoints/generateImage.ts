import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class GenerateImage extends BaseEndpoint {
  schema = {
    tags: ["AI"],
    summary: "(paid) Generate image from text prompt using Flux AI",
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
              prompt: { type: "string" as const } as const,
            } as const,
          } as const,
        } as const,
      } as const,
    },
    responses: {
      "200": {
        description: "Generated image",
        content: {
          "image/png": {
            schema: {
              type: "string" as const,
              format: "binary" as const,
            } as const,
          } as const,
        } as const,
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body;
    try {
      body = await c.req.json<{ prompt: string }>();
      if (!body.prompt || typeof body.prompt !== "string") {
        return this.errorResponse(c, "Missing or invalid 'prompt'", 400);
      }
    } catch (error) {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    try {
      const output = await c.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
        prompt: body.prompt,
      });
      if (!output.image) {
        return this.errorResponse(c, "No image generated", 500);
      }

      // Convert base64 to Uint8Array for binary response
      const imgBytes = Uint8Array.from(atob(output.image), (c) => c.charCodeAt(0));
      return new Response(imgBytes, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `AI inference failed: ${String(error)}`,
        500
      );
    }
  }
}
