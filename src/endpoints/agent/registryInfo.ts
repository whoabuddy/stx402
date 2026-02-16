import type { AppContext } from "../../types";
import { ERC8004_CONTRACTS } from "../../utils/erc8004";
import { BaseEndpoint } from "../BaseEndpoint";

/**
 * Free endpoint - no payment required
 * Returns ERC-8004 registry contract addresses and metadata
 */
export class RegistryInfo extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(free) Get ERC-8004 registry contract addresses and versions",
    parameters: [],
    responses: {
      "200": {
        description: "Registry information",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                networks: {
                  type: "object",
                  properties: {
                    testnet: {
                      type: "object",
                      properties: {
                        deployer: { type: "string" },
                        identity: { type: "string" },
                        reputation: { type: "string" },
                        validation: { type: "string" },
                      },
                    },
                    mainnet: {
                      type: "object",
                      nullable: true,
                    },
                  },
                },
                specification: {
                  type: "object",
                  properties: {
                    sipUrl: { type: "string" },
                    erc8004Url: { type: "string" },
                    referenceImpl: { type: "string" },
                  },
                },
                registries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    return c.json({
      networks: {
        testnet: ERC8004_CONTRACTS.testnet,
        mainnet: ERC8004_CONTRACTS.mainnet,
      },
      specification: {
        sipUrl:
          "https://github.com/stacksgov/sips/blob/feat/sip-erc-8004-agent-registries/sips/sip-XXX/sip-XXX-agent-registries.md",
        erc8004Url: "https://eips.ethereum.org/EIPS/eip-8004",
        referenceImpl: "https://github.com/aibtcdev/erc-8004-stacks",
      },
      registries: [
        {
          name: "identity",
          description:
            "Agent registration with sequential IDs, metadata URIs, and operator approvals",
        },
        {
          name: "reputation",
          description:
            "Client feedback system with scores (0-100), tags, revocation, and SIP-018 signatures",
        },
        {
          name: "validation",
          description:
            "Third-party verification requests and responses for agent capabilities",
        },
      ],
      chainIds: {
        mainnet: 1,
        testnet: 2147483648,
      },
      caip2Format: "stacks:<chainId>:<registry>:<agentId>",
    });
  }
}
