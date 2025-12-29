import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilStringDistance extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Calculate string distance (Levenshtein/similarity)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["string1", "string2"],
            properties: {
              string1: { type: "string" as const, description: "First string" },
              string2: { type: "string" as const, description: "Second string" },
              caseSensitive: { type: "boolean" as const, default: true },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "String distance metrics",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                levenshtein: { type: "integer" as const },
                similarity: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { string1?: string; string2?: string; caseSensitive?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    let { string1, string2 } = body;
    const { caseSensitive = true } = body;

    if (typeof string1 !== "string" || typeof string2 !== "string") {
      return this.errorResponse(c, "string1 and string2 are required", 400);
    }

    if (!caseSensitive) {
      string1 = string1.toLowerCase();
      string2 = string2.toLowerCase();
    }

    const levenshtein = this.levenshteinDistance(string1, string2);
    const maxLen = Math.max(string1.length, string2.length);
    const similarity = maxLen === 0 ? 1 : 1 - levenshtein / maxLen;

    // Calculate Jaro-Winkler similarity
    const jaroWinkler = this.jaroWinklerSimilarity(string1, string2);

    return c.json({
      levenshtein,
      similarity: Math.round(similarity * 10000) / 10000,
      similarityPercent: Math.round(similarity * 100 * 100) / 100,
      jaroWinkler: Math.round(jaroWinkler * 10000) / 10000,
      string1Length: string1.length,
      string2Length: string2.length,
      caseSensitive,
      tokenType,
    });
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[m][n];
  }

  private jaroWinklerSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, s2.length);

      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

    // Jaro-Winkler prefix bonus
    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }
}
