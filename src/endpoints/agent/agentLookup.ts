import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  extractTypedValue,
  isSome,
  uint,
} from "../../utils/erc8004";
import {
  AGENT_COMMON_PARAMS,
  COMMON_ERROR_RESPONSES,
  obj,
  str,
  num,
  bool,
  arr,
  jsonResponse,
} from "../../utils/schema-helpers";

/**
 * Lookup agents by scanning through sequential IDs
 * Note: This is a simple implementation that scans up to maxScan agents
 * A production implementation might use an indexer for better performance
 */
export class AgentLookup extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Lookup agents by owner address",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: obj(
            {
              owner: { ...str, description: "Owner principal to search for" },
              startId: { ...num, description: "Agent ID to start scanning from (default: 0)", default: 0 },
              maxScan: { ...num, description: "Maximum agents to scan (default: 100, max: 500)", default: 100 },
            },
            ["owner"]
          ),
        },
      },
    },
    parameters: AGENT_COMMON_PARAMS,
    responses: {
      "200": jsonResponse(
        "List of agents owned by the address",
        obj({
          owner: str,
          agents: arr(obj({ agentId: num, uri: str })),
          count: num,
          scanned: num,
          startId: num,
          hasMore: bool,
          network: str,
          tokenType: str,
        })
      ),
      ...COMMON_ERROR_RESPONSES,
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = this.getNetwork(c);
    const log = c.var.logger;

    log.info("Agent lookup request", { network, tokenType });

    const mainnetError = this.checkMainnetDeployment(c, network);
    if (mainnetError) {
      log.warn("Mainnet not supported for agent lookup");
      return mainnetError;
    }

    const parsed = await this.parseJsonBody<{ owner?: string; startId?: number; maxScan?: number }>(c);
    if (parsed.error) return parsed.error;
    const body = parsed.body;

    const { owner, startId = 0, maxScan = 100 } = body;

    if (!owner) {
      return this.errorResponse(c, "owner principal is required", 400);
    }

    const effectiveMaxScan = Math.min(maxScan, 500);

    try {
      const agents: Array<{ agentId: number; uri: string | null }> = [];
      let scanned = 0;
      let consecutiveNotFound = 0;
      const MAX_CONSECUTIVE_NOT_FOUND = 10;

      for (let id = startId; scanned < effectiveMaxScan; id++) {
        scanned++;

        try {
          // owner-of returns (optional principal)
          const ownerResult = await callRegistryFunction(
            network,
            "identity",
            "owner-of",
            [uint(id)]
          );
          const ownerJson = clarityToJson(ownerResult);

          if (!isSome(ownerJson)) {
            // Agent doesn't exist (none) or unexpected format
            consecutiveNotFound++;
            if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
              // Assume we've reached the end of registered agents
              break;
            }
            continue;
          }

          consecutiveNotFound = 0;
          const ownerValue = extractValue(ownerJson);
          const agentOwner = extractTypedValue(ownerValue) as string;

          if (agentOwner === owner) {
            // Found a match, get the URI too
            let uri: string | null = null;
            try {
              const uriResult = await callRegistryFunction(
                network,
                "identity",
                "get-uri",
                [uint(id)]
              );
              const uriJson = clarityToJson(uriResult);
              if (isSome(uriJson)) {
                const uriValue = extractValue(uriJson);
                uri = (extractTypedValue(uriValue) as string) || null;
              }
            } catch {
              // URI fetch failed, continue without it
            }

            agents.push({ agentId: id, uri });
          }
        } catch {
          // Error fetching this agent, skip
          consecutiveNotFound++;
          if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
            break;
          }
        }
      }

      log.info("Agent lookup completed", {
        owner,
        count: agents.length,
        scanned,
        startId,
        hasMore: scanned >= effectiveMaxScan,
      });

      return c.json({
        owner,
        agents,
        count: agents.length,
        scanned,
        startId,
        hasMore: scanned >= effectiveMaxScan,
        network,
        tokenType,
      });
    } catch (error) {
      log.error("Agent lookup failed", { error: String(error) });
      return this.errorResponse(
        c,
        `Failed to lookup agents: ${String(error)}`,
        400
      );
    }
  }
}
