import type { Context } from "hono";
import type { Logger } from "./utils/logger";
import type { SettlementResponseV2, PaymentPayloadV2 } from "x402-stacks";

export interface AppVariables {
  logger: Logger;
  // V2 payment context
  settleResult?: SettlementResponseV2;
  paymentPayload?: PaymentPayloadV2;
}

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

// Re-export V2 types for use in endpoints
export type { SettlementResponseV2, PaymentPayloadV2 } from "x402-stacks";
