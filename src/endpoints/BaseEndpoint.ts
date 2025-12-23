import { OpenAPIRoute } from "chanfana";
import { validateStacksAddress } from "@stacks/transactions";
import { validateTokenType } from "../utils/pricing";
import type { AppContext } from "../types";
import { ContentfulStatusCode } from "hono/utils/http-status";

export class BaseEndpoint extends OpenAPIRoute {
  protected getTokenType(c: AppContext): string {
    const rawTokenType = c.req.query("tokenType") || "STX";
    return validateTokenType(rawTokenType);
  }

  protected validateAddress(c: AppContext): string | null {
    const address = c.req.param("address");
    return validateStacksAddress(address) ? address : null;
  }

  protected errorResponse(
    c: AppContext,
    error: string,
    status: ContentfulStatusCode,
    extra: Record<string, unknown> = {}
  ): Response {
    const tokenType = this.getTokenType(c);
    return c.json({ tokenType, error, ...extra }, status);
  }
}
