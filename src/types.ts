import type { Context } from "hono";
import type { Logger } from "./utils/logger";

export interface AppVariables {
  logger: Logger;
}

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

/**
 * Extended settle result that includes sender address in various formats.
 * Used for payment verification and user identification.
 * Consolidates the different address formats that facilitators may return.
 */
export interface ExtendedSettleResult {
  isValid: boolean;
  txId?: string;
  status?: string;
  blockHeight?: number;
  error?: string;
  reason?: string;
  validationError?: string;
  // Various address field formats - facilitators may use different naming
  sender?: string;
  senderAddress?: string;
  sender_address?: string;
  recipient?: string;
  recipientAddress?: string;
  recipient_address?: string;
  amount?: string | number;
}
