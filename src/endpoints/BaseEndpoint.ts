import { OpenAPIRoute } from "chanfana";
import { Address } from "@stacks/transactions";
import { validateTokenType } from "../utils/pricing";
import type { AppContext, SettlementResponseV2, PaymentPayloadV2 } from "../types";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { ERC8004_CONTRACTS, type ERC8004Network } from "../utils/erc8004";
import {
  verifyStructuredSignature,
  getDomain,
  createActionMessage,
  createSignatureRequest,
  isTimestampValid,
  getChallenge,
  consumeChallenge,
  type SignatureRequest,
  type SignedAction,
} from "../utils/signatures";
import { payerMatchesAddress, extractSenderHash160FromSignedTx } from "../utils/payment";
import type { UserDurableObject } from "../durable-objects/UserDurableObject";

/** Result of dual authentication (signature or payment) */
export type AuthResult =
  | { authenticated: true; method: "signature" | "payment" }
  | { authenticated: false; error: Response; signatureRequest?: SignatureRequest };

export class BaseEndpoint extends OpenAPIRoute {
  /**
   * Get the network from query parameter with consistent default
   */
  protected getNetwork(c: AppContext): ERC8004Network {
    return (c.req.query("network") || "testnet") as ERC8004Network;
  }

  /**
   * Check if mainnet contracts are deployed. Returns an error response if not.
   * Returns null if the check passes (mainnet is deployed or using testnet).
   */
  protected checkMainnetDeployment(
    c: AppContext,
    network: ERC8004Network
  ): Response | null {
    if (network === "mainnet" && !ERC8004_CONTRACTS.mainnet) {
      return this.errorResponse(
        c,
        "ERC-8004 contracts not yet deployed on mainnet",
        501
      );
    }
    return null;
  }

  /**
   * Parse JSON request body with standardized error handling.
   * Returns the parsed body or an error response.
   */
  protected async parseJsonBody<T>(
    c: AppContext
  ): Promise<{ body: T; error?: never } | { body?: never; error: Response }> {
    try {
      const body = (await c.req.json()) as T;
      return { body };
    } catch {
      return { error: this.errorResponse(c, "Invalid JSON body", 400) };
    }
  }

  /**
   * Validate an agent ID value. Returns an error response if invalid.
   */
  protected validateAgentId(
    c: AppContext,
    agentId: number | undefined,
    source: "query" | "body" = "body"
  ): Response | null {
    if (agentId === undefined || agentId < 0) {
      const message =
        source === "query"
          ? "agentId query parameter is required and must be >= 0"
          : "agentId is required and must be >= 0";
      return this.errorResponse(c, message, 400);
    }
    return null;
  }

  protected getTokenType(c: AppContext): string {
    const rawTokenType = c.req.query("tokenType") || "STX";
    return validateTokenType(rawTokenType);
  }

  /**
   * Get the payer's address from the payment settlement result or payment payload
   * This is set by the x402 middleware after successful payment verification
   */
  protected getPayerAddress(c: AppContext): string | null {
    const settleResult = c.get("settleResult") as SettlementResponseV2 | undefined;
    const paymentPayload = c.get("paymentPayload") as PaymentPayloadV2 | undefined;
    const network = (c.env?.X402_NETWORK ?? "mainnet") as "mainnet" | "testnet";

    // V2: Use 'payer' field from settlement result
    if (settleResult?.payer) {
      return settleResult.payer;
    }

    // Fallback: extract sender from payment payload's signed transaction
    if (paymentPayload?.payload?.transaction) {
      const signedTx = paymentPayload.payload.transaction;
      const hash160 = extractSenderHash160FromSignedTx(signedTx);
      if (hash160) {
        const network = c.env.X402_NETWORK as "mainnet" | "testnet";
        const addressVersion = network === "mainnet" ? 22 : 26;
        return Address.stringify({ hash160, type: addressVersion });
      }
    }

    return null;
  }

  /**
   * Resolve owner address from provided value or fall back to payer address.
   * Returns the validated address or an error response.
   */
  protected resolveOwnerAddress(
    c: AppContext,
    providedOwner?: string
  ): { address: string; error?: never } | { address?: never; error: Response } {
    if (providedOwner) {
      try {
        const addressObj = Address.parse(providedOwner);
        return { address: Address.stringify(addressObj) };
      } catch {
        return { error: this.errorResponse(c, "Invalid owner address format", 400) };
      }
    }

    const payerAddress = this.getPayerAddress(c);
    if (!payerAddress) {
      return {
        error: this.errorResponse(
          c,
          "Could not determine owner from payment. Please specify owner address.",
          400
        ),
      };
    }
    return { address: payerAddress };
  }

  /**
   * Authenticate owner via signature OR payment from same address.
   * Used for operations that accept dual authentication.
   *
   * @param action - The action name for signature verification (e.g., "list-my-endpoints")
   * @param actionData - Data to include in the signed message
   */
  protected authenticateOwner(
    c: AppContext,
    ownerAddress: string,
    signature?: string,
    timestamp?: number,
    action?: SignedAction,
    actionData?: Record<string, unknown>
  ): AuthResult {
    const tokenType = this.getTokenType(c);
    const network = c.env.X402_NETWORK as "mainnet" | "testnet";

    // Try signature auth first
    if (signature) {
      if (!timestamp) {
        return {
          authenticated: false,
          error: this.errorResponse(c, "timestamp is required when providing signature", 400),
        };
      }

      if (!isTimestampValid(timestamp)) {
        return {
          authenticated: false,
          error: c.json(
            { error: "Signature timestamp expired. Sign a fresh message.", tokenType },
            403
          ),
        };
      }

      const domain = getDomain(network);
      const message = createActionMessage(action || "authenticate", {
        owner: ownerAddress,
        timestamp,
        ...actionData,
      });

      const verifyResult = verifyStructuredSignature(
        message,
        domain,
        signature,
        ownerAddress,
        network
      );

      if (!verifyResult.valid) {
        return {
          authenticated: false,
          error: c.json(
            {
              error: "Invalid signature",
              details: verifyResult.error,
              recoveredAddress: verifyResult.recoveredAddress,
              expectedAddress: ownerAddress,
              tokenType,
            },
            403
          ),
        };
      }

      return { authenticated: true, method: "signature" };
    }

    // Try payment auth
    const settleResult = c.get("settleResult") as SettlementResponseV2 | undefined;
    const paymentPayload = c.get("paymentPayload") as PaymentPayloadV2 | undefined;
    const signedTx = paymentPayload?.payload?.transaction || null;

    if (payerMatchesAddress(settleResult || null, signedTx, ownerAddress)) {
      return { authenticated: true, method: "payment" };
    }

    // Neither method worked - return signature request
    const signatureRequest = createSignatureRequest(
      action || "authenticate",
      { owner: ownerAddress, ...actionData },
      network,
      false
    );

    return {
      authenticated: false,
      error: c.json({
        error: "Authentication required",
        message: "Provide a signature or pay from the owner address",
        signatureRequest,
        instructions: {
          option1: "Sign the message with your wallet and include signature + timestamp",
          option2: "Pay for this request from the same address",
        },
        tokenType,
      }),
      signatureRequest,
    };
  }

  /**
   * Authenticate with a challenge-based signature (for destructive operations).
   * First call returns a challenge, second call with signature verifies it.
   */
  protected authenticateWithChallenge(
    c: AppContext,
    ownerAddress: string,
    action: string,
    actionData: Record<string, unknown>,
    signature?: string,
    challengeId?: string
  ): AuthResult {
    const tokenType = this.getTokenType(c);
    const network = c.env.X402_NETWORK as "mainnet" | "testnet";

    // No signature - issue a challenge
    if (!signature) {
      const signatureRequest = createSignatureRequest(action, actionData, network, true);

      return {
        authenticated: false,
        error: c.json({
          requiresSignature: true,
          message: `${action} operation requires a signed challenge. Sign the message and resubmit.`,
          challenge: signatureRequest,
          tokenType,
        }),
        signatureRequest,
      };
    }

    // Signature provided - verify it
    if (!challengeId) {
      return {
        authenticated: false,
        error: this.errorResponse(c, "challengeId is required when providing signature", 400),
      };
    }

    const challenge = getChallenge(challengeId);
    if (!challenge) {
      return {
        authenticated: false,
        error: c.json(
          { error: "Challenge expired or invalid. Request a new challenge.", tokenType },
          403
        ),
      };
    }

    if (challenge.owner !== ownerAddress) {
      return {
        authenticated: false,
        error: c.json(
          { error: "Challenge was issued for a different owner", tokenType },
          403
        ),
      };
    }

    // Reconstruct the message
    const domain = getDomain(network);
    const timestamp = challenge.expiresAt - 5 * 60 * 1000;
    const message = createActionMessage(action, { ...actionData, timestamp });

    const verifyResult = verifyStructuredSignature(
      message,
      domain,
      signature,
      ownerAddress,
      network
    );

    if (!verifyResult.valid) {
      consumeChallenge(challengeId);
      return {
        authenticated: false,
        error: c.json(
          {
            error: "Invalid signature",
            details: verifyResult.error,
            recoveredAddress: verifyResult.recoveredAddress,
            expectedAddress: ownerAddress,
            tokenType,
          },
          403
        ),
      };
    }

    consumeChallenge(challengeId);
    return { authenticated: true, method: "signature" };
  }

  /**
   * Get a UserDurableObject stub for a given address.
   */
  protected getUserDO(c: AppContext, address: string): DurableObjectStub<UserDurableObject> {
    const id = c.env.USER_DO.idFromName(address);
    return c.env.USER_DO.get(id) as DurableObjectStub<UserDurableObject>;
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
