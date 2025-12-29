import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextDiff extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Compare two texts and show differences",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text1", "text2"],
            properties: {
              text1: { type: "string" as const, description: "First text" },
              text2: { type: "string" as const, description: "Second text" },
              mode: {
                type: "string" as const,
                enum: ["lines", "words", "chars"] as const,
                default: "lines",
                description: "Comparison mode",
              },
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
        description: "Diff result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                identical: { type: "boolean" as const },
                changes: { type: "array" as const },
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

    let body: { text1?: string; text2?: string; mode?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text1, text2, mode = "lines" } = body;

    if (typeof text1 !== "string" || typeof text2 !== "string") {
      return this.errorResponse(c, "text1 and text2 are required strings", 400);
    }

    const validModes = ["lines", "words", "chars"];
    if (!validModes.includes(mode)) {
      return this.errorResponse(c, `mode must be one of: ${validModes.join(", ")}`, 400);
    }

    // Split based on mode
    let arr1: string[];
    let arr2: string[];

    switch (mode) {
      case "lines":
        arr1 = text1.split("\n");
        arr2 = text2.split("\n");
        break;
      case "words":
        arr1 = text1.split(/\s+/).filter((w) => w);
        arr2 = text2.split(/\s+/).filter((w) => w);
        break;
      case "chars":
        arr1 = text1.split("");
        arr2 = text2.split("");
        break;
      default:
        arr1 = text1.split("\n");
        arr2 = text2.split("\n");
    }

    // Simple diff algorithm (Myers-like approach simplified)
    const changes = this.computeDiff(arr1, arr2);

    const stats = {
      added: changes.filter((c) => c.type === "add").length,
      removed: changes.filter((c) => c.type === "remove").length,
      unchanged: changes.filter((c) => c.type === "unchanged").length,
    };

    return c.json({
      identical: text1 === text2,
      mode,
      changes,
      stats,
      similarity: stats.unchanged / Math.max(arr1.length, arr2.length, 1),
      tokenType,
    });
  }

  private computeDiff(arr1: string[], arr2: string[]): Array<{ type: string; value: string; index?: number }> {
    const result: Array<{ type: string; value: string; index?: number }> = [];

    // Use LCS-based approach
    const lcs = this.longestCommonSubsequence(arr1, arr2);

    let i = 0;
    let j = 0;
    let k = 0;

    while (i < arr1.length || j < arr2.length) {
      if (k < lcs.length && i < arr1.length && arr1[i] === lcs[k]) {
        if (j < arr2.length && arr2[j] === lcs[k]) {
          result.push({ type: "unchanged", value: arr1[i] });
          i++;
          j++;
          k++;
        } else {
          result.push({ type: "add", value: arr2[j], index: j });
          j++;
        }
      } else if (i < arr1.length && (k >= lcs.length || arr1[i] !== lcs[k])) {
        result.push({ type: "remove", value: arr1[i], index: i });
        i++;
      } else if (j < arr2.length) {
        result.push({ type: "add", value: arr2[j], index: j });
        j++;
      }
    }

    return result;
  }

  private longestCommonSubsequence(arr1: string[], arr2: string[]): string[] {
    const m = arr1.length;
    const n = arr2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find LCS
    const lcs: string[] = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (arr1[i - 1] === arr2[j - 1]) {
        lcs.unshift(arr1[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs;
  }
}
