import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum",
];

export class TextLoremIpsum extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Generate lorem ipsum placeholder text",
    parameters: [
      {
        name: "type",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["words", "sentences", "paragraphs"] as const, default: "paragraphs" },
      },
      {
        name: "count",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const, default: 3, minimum: 1, maximum: 100 },
      },
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "Generated lorem ipsum text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                text: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid parameters" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const type = c.req.query("type") || "paragraphs";
    const count = Math.min(100, Math.max(1, parseInt(c.req.query("count") || "3", 10)));

    const validTypes = ["words", "sentences", "paragraphs"];
    if (!validTypes.includes(type)) {
      return this.errorResponse(c, `type must be one of: ${validTypes.join(", ")}`, 400);
    }

    let text: string;

    switch (type) {
      case "words":
        text = this.generateWords(count);
        break;
      case "sentences":
        text = this.generateSentences(count);
        break;
      case "paragraphs":
      default:
        text = this.generateParagraphs(count);
        break;
    }

    return c.json({
      text,
      type,
      count,
      wordCount: text.split(/\s+/).length,
      characterCount: text.length,
      tokenType,
    });
  }

  private getRandomWord(): string {
    return LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)];
  }

  private generateWords(count: number): string {
    const words: string[] = [];
    for (let i = 0; i < count; i++) {
      words.push(this.getRandomWord());
    }
    return words.join(" ");
  }

  private generateSentence(): string {
    const length = 8 + Math.floor(Math.random() * 10);
    const words: string[] = [];
    for (let i = 0; i < length; i++) {
      words.push(this.getRandomWord());
    }
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return words.join(" ") + ".";
  }

  private generateSentences(count: number): string {
    const sentences: string[] = [];
    for (let i = 0; i < count; i++) {
      sentences.push(this.generateSentence());
    }
    return sentences.join(" ");
  }

  private generateParagraph(): string {
    const sentenceCount = 4 + Math.floor(Math.random() * 4);
    return this.generateSentences(sentenceCount);
  }

  private generateParagraphs(count: number): string {
    const paragraphs: string[] = [];
    for (let i = 0; i < count; i++) {
      paragraphs.push(this.generateParagraph());
    }
    return paragraphs.join("\n\n");
  }
}
