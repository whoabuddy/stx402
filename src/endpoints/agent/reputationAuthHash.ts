import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  computeSip018MessageHash,
  computeDomainHash,
  computeFeedbackAuthHash,
  REPUTATION_DOMAIN,
} from "../../utils/erc8004";
import {
  AGENT_COMMON_PARAMS,
  COMMON_ERROR_RESPONSES,
  obj,
  str,
  num,
  jsonResponse,
} from "../../utils/schema-helpers";

export class ReputationAuthHash extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Generate SIP-018 message hash for off-chain feedback authorization",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: obj(
            {
              agentId: { ...num, description: "Agent ID to authorize feedback for" },
              signer: { ...str, description: "Principal who will be authorized (agent owner/operator)" },
              indexLimit: { ...num, description: "Maximum feedback index allowed" },
              expiryBlockHeight: { ...num, description: "Block height when authorization expires" },
            },
            ["agentId", "signer", "indexLimit", "expiryBlockHeight"]
          ),
        },
      },
    },
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "SIP-018 message hash and structured data",
        obj({
          messageHash: { ...str, description: "Hex-encoded hash to sign with your private key" },
          domainHash: str,
          structuredDataHash: str,
          domain: obj({ name: str, version: str, chainId: num }),
          structuredData: obj({ agentId: num, signer: str, indexLimit: num, expiryBlockHeight: num }),
          instructions: str,
          network: str,
          tokenType: str,
        })
      ),
      ...COMMON_ERROR_RESPONSES,
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = this.getAgentNetwork(c);

    const mainnetError = this.checkMainnetDeployment(c, network);
    if (mainnetError) return mainnetError;

    const parsed = await this.parseJsonBody<{
      agentId?: number;
      signer?: string;
      indexLimit?: number;
      expiryBlockHeight?: number;
    }>(c);
    if (parsed.error) return parsed.error;

    const { agentId, signer, indexLimit, expiryBlockHeight } = parsed.body;

    const agentIdError = this.validateAgentId(c, agentId);
    if (agentIdError) return agentIdError;
    if (!signer) {
      return this.errorResponse(c, "signer principal is required", 400);
    }
    if (indexLimit === undefined || indexLimit < 0) {
      return this.errorResponse(c, "indexLimit is required and must be >= 0", 400);
    }
    if (expiryBlockHeight === undefined || expiryBlockHeight < 0) {
      return this.errorResponse(
        c,
        "expiryBlockHeight is required and must be >= 0",
        400
      );
    }

    try {
      const params = { agentId, signer, indexLimit, expiryBlockHeight };
      const messageHash = computeSip018MessageHash(network, params);
      const domainHash = computeDomainHash(network);
      const structuredDataHash = computeFeedbackAuthHash(params);

      const chainId = REPUTATION_DOMAIN.chainId[network];

      return c.json({
        messageHash: `0x${messageHash}`,
        domainHash: `0x${domainHash}`,
        structuredDataHash: `0x${structuredDataHash}`,
        domain: {
          name: REPUTATION_DOMAIN.name,
          version: REPUTATION_DOMAIN.version,
          chainId,
        },
        structuredData: {
          agentId,
          signer,
          indexLimit,
          expiryBlockHeight,
        },
        instructions: [
          "1. Sign the messageHash with your private key using secp256k1",
          "2. The signature should be 65 bytes (r: 32, s: 32, v: 1)",
          "3. Call give-feedback-signed with the signature and these parameters",
          "4. The signer must be the agent owner or an approved operator",
        ].join("\n"),
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to compute auth hash: ${String(error)}`,
        400
      );
    }
  }
}
