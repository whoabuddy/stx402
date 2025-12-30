import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class MathCalculate extends BaseEndpoint {
  schema = {
    tags: ["Math"],
    summary: "(paid) Evaluate a mathematical expression",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["expression"],
            properties: {
              expression: {
                type: "string" as const,
                description: "Mathematical expression to evaluate (supports +, -, *, /, ^, %, sqrt, sin, cos, tan, log, ln, pi, e)",
              },
              precision: {
                type: "integer" as const,
                default: 10,
                description: "Decimal precision for result",
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
        description: "Calculation result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                expression: { type: "string" as const },
                result: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid expression" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { expression?: string; precision?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { expression, precision = 10 } = body;

    if (typeof expression !== "string" || expression.trim().length === 0) {
      return this.errorResponse(c, "expression field is required", 400);
    }

    try {
      const parser = new ExpressionParser(expression);
      const result = parser.parse();

      if (!isFinite(result)) {
        return this.errorResponse(c, "Result is not a finite number", 400);
      }

      const rounded = Math.round(result * Math.pow(10, precision)) / Math.pow(10, precision);

      return c.json({
        expression,
        result: rounded,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Invalid expression: ${error instanceof Error ? error.message : String(error)}`, 400);
    }
  }
}

// Token types for the expression parser
type TokenType = "NUMBER" | "OPERATOR" | "FUNCTION" | "LPAREN" | "RPAREN" | "EOF";

interface Token {
  type: TokenType;
  value: string | number;
}

// Recursive descent parser for mathematical expressions
class ExpressionParser {
  private tokens: Token[] = [];
  private pos = 0;

  constructor(expression: string) {
    this.tokenize(expression.toLowerCase());
  }

  private tokenize(expr: string): void {
    const patterns = [
      { regex: /^\s+/, type: null }, // Skip whitespace
      { regex: /^(\d+\.?\d*|\.\d+)/, type: "NUMBER" as TokenType },
      { regex: /^(pi|e)\b/, type: "NUMBER" as TokenType }, // Constants
      { regex: /^(sqrt|sin|cos|tan|log|ln|abs|floor|ceil|round)\b/, type: "FUNCTION" as TokenType },
      { regex: /^[+\-]/, type: "OPERATOR" as TokenType },
      { regex: /^[*/%^]/, type: "OPERATOR" as TokenType },
      { regex: /^\(/, type: "LPAREN" as TokenType },
      { regex: /^\)/, type: "RPAREN" as TokenType },
    ];

    let remaining = expr;
    while (remaining.length > 0) {
      let matched = false;
      for (const { regex, type } of patterns) {
        const match = remaining.match(regex);
        if (match) {
          if (type) {
            let value: string | number = match[0];
            if (type === "NUMBER") {
              if (value === "pi") value = Math.PI;
              else if (value === "e") value = Math.E;
              else value = parseFloat(value);
            }
            this.tokens.push({ type, value });
          }
          remaining = remaining.slice(match[0].length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        throw new Error(`Unexpected character: ${remaining[0]}`);
      }
    }
    this.tokens.push({ type: "EOF", value: "" });
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: "EOF", value: "" };
  }

  private consume(type?: TokenType): Token {
    const token = this.current();
    if (type && token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    this.pos++;
    return token;
  }

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset] || { type: "EOF", value: "" };
  }

  parse(): number {
    const result = this.parseExpression();
    if (this.current().type !== "EOF") {
      throw new Error("Unexpected token after expression");
    }
    return result;
  }

  // Expression: Term (('+' | '-') Term)*
  private parseExpression(): number {
    let left = this.parseTerm();

    while (this.current().type === "OPERATOR" && (this.current().value === "+" || this.current().value === "-")) {
      const op = this.consume().value;
      const right = this.parseTerm();
      left = op === "+" ? left + right : left - right;
    }

    return left;
  }

  // Term: Power (('*' | '/' | '%') Power)*
  private parseTerm(): number {
    let left = this.parsePower();

    while (this.current().type === "OPERATOR" && (this.current().value === "*" || this.current().value === "/" || this.current().value === "%")) {
      const op = this.consume().value;
      const right = this.parsePower();
      if (op === "*") left = left * right;
      else if (op === "/") {
        if (right === 0) throw new Error("Division by zero");
        left = left / right;
      } else left = left % right;
    }

    return left;
  }

  // Power: Unary ('^' Power)?
  private parsePower(): number {
    const base = this.parseUnary();

    if (this.current().type === "OPERATOR" && this.current().value === "^") {
      this.consume();
      const exponent = this.parsePower(); // Right associative
      return Math.pow(base, exponent);
    }

    return base;
  }

  // Unary: ('+' | '-')? Primary
  private parseUnary(): number {
    if (this.current().type === "OPERATOR" && (this.current().value === "+" || this.current().value === "-")) {
      const op = this.consume().value;
      const value = this.parseUnary();
      return op === "-" ? -value : value;
    }
    return this.parsePrimary();
  }

  // Primary: NUMBER | FUNCTION '(' Expression ')' | '(' Expression ')'
  private parsePrimary(): number {
    const token = this.current();

    if (token.type === "NUMBER") {
      this.consume();
      return token.value as number;
    }

    if (token.type === "FUNCTION") {
      const func = this.consume().value as string;
      this.consume("LPAREN");
      const arg = this.parseExpression();
      this.consume("RPAREN");
      return this.applyFunction(func, arg);
    }

    if (token.type === "LPAREN") {
      this.consume();
      const value = this.parseExpression();
      this.consume("RPAREN");
      return value;
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }

  private applyFunction(func: string, arg: number): number {
    switch (func) {
      case "sqrt":
        if (arg < 0) throw new Error("Cannot take sqrt of negative number");
        return Math.sqrt(arg);
      case "sin":
        return Math.sin(arg);
      case "cos":
        return Math.cos(arg);
      case "tan":
        return Math.tan(arg);
      case "log":
        if (arg <= 0) throw new Error("log requires positive argument");
        return Math.log10(arg);
      case "ln":
        if (arg <= 0) throw new Error("ln requires positive argument");
        return Math.log(arg);
      case "abs":
        return Math.abs(arg);
      case "floor":
        return Math.floor(arg);
      case "ceil":
        return Math.ceil(arg);
      case "round":
        return Math.round(arg);
      default:
        throw new Error(`Unknown function: ${func}`);
    }
  }
}
