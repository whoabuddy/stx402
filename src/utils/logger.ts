/**
 * Centralized Logger for Cloudflare Workers
 *
 * Sends logs to worker-logs service via RPC binding.
 * Uses CF-Ray ID for request correlation with Cloudflare dashboard.
 *
 * Usage:
 *   // In middleware (creates logger and stores in context)
 *   app.use('*', loggerMiddleware)
 *
 *   // In endpoints
 *   const log = getLogger(c)
 *   log.info("Processing request")
 *   log.error("Payment failed", { reason: "insufficient funds" })
 */

import type { Context, ExecutionContext } from "hono";

// =============================================================================
// Types
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  rayId?: string;
  path?: string;
  payer?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  child(additionalContext: LogContext): Logger;
}

/**
 * LogsRPC interface matching worker-logs service binding
 * Defined locally since worker-logs isn't a published package
 */
interface LogsRPC {
  debug(appId: string, message: string, context?: Record<string, unknown>): Promise<unknown>;
  info(appId: string, message: string, context?: Record<string, unknown>): Promise<unknown>;
  warn(appId: string, message: string, context?: Record<string, unknown>): Promise<unknown>;
  error(appId: string, message: string, context?: Record<string, unknown>): Promise<unknown>;
}

// App identifier for worker-logs
const APP_ID = "stx402";

// =============================================================================
// Console Fallback (for local dev without LOGS binding)
// =============================================================================

function createConsoleLogger(baseContext?: LogContext): Logger {
  const formatMessage = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const ctx = { ...baseContext, ...data };
    const ctxStr = Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : "";
    return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}${ctxStr}`;
  };

  return {
    debug: (msg, data) => console.debug(formatMessage("debug", msg, data)),
    info: (msg, data) => console.info(formatMessage("info", msg, data)),
    warn: (msg, data) => console.warn(formatMessage("warn", msg, data)),
    error: (msg, data) => console.error(formatMessage("error", msg, data)),
    child: (additionalContext) => createConsoleLogger({ ...baseContext, ...additionalContext }),
  };
}

// =============================================================================
// RPC Logger (production)
// =============================================================================

/**
 * Create a logger that sends to worker-logs via RPC
 *
 * @param logs - The LOGS service binding from env
 * @param ctx - Execution context for waitUntil
 * @param baseContext - Base context included in all log entries
 */
export function createLogger(
  logs: LogsRPC,
  ctx: ExecutionContext,
  baseContext?: LogContext
): Logger {
  // Helper to merge context and send via RPC
  // Uses direct method calls instead of dynamic access for RPC Proxy compatibility
  const send = (
    rpcCall: Promise<unknown>,
    level: string,
    message: string,
    context: Record<string, unknown>
  ) => {
    ctx.waitUntil(
      rpcCall.catch((err) => {
        console.error(`[logger] Failed to send ${level} log: ${err}`);
        console.error(`[logger] Original message: ${message}`, context);
      })
    );
  };

  return {
    debug: (msg, data) => {
      const context = { ...baseContext, ...data };
      send(logs.debug(APP_ID, msg, context), "debug", msg, context);
    },
    info: (msg, data) => {
      const context = { ...baseContext, ...data };
      send(logs.info(APP_ID, msg, context), "info", msg, context);
    },
    warn: (msg, data) => {
      const context = { ...baseContext, ...data };
      send(logs.warn(APP_ID, msg, context), "warn", msg, context);
    },
    error: (msg, data) => {
      const context = { ...baseContext, ...data };
      send(logs.error(APP_ID, msg, context), "error", msg, context);
    },
    child: (additionalContext) =>
      createLogger(logs, ctx, { ...baseContext, ...additionalContext }),
  };
}

// =============================================================================
// Hono Integration
// =============================================================================

// Context key for storing logger
const LOGGER_KEY = "logger";

/**
 * Hono middleware that creates a logger and stores it in context
 *
 * Usage in index.ts:
 *   import { loggerMiddleware } from "./utils/logger"
 *   app.use('*', loggerMiddleware)
 */
export function loggerMiddleware(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>
) {
  const rayId = c.req.header("cf-ray") || "local";
  const path = c.req.path;
  const baseContext: LogContext = { rayId, path };

  // Use RPC logger if LOGS binding available, otherwise console
  const logger = c.env.LOGS
    ? createLogger(c.env.LOGS as unknown as LogsRPC, c.executionCtx, baseContext)
    : createConsoleLogger(baseContext);

  c.set(LOGGER_KEY, logger);
  return next();
}

/**
 * Get logger from Hono context
 *
 * Usage in endpoints:
 *   const log = getLogger(c)
 *   log.info("Processing request")
 */
export function getLogger(c: Context): Logger {
  const logger = c.get(LOGGER_KEY) as Logger | undefined;
  if (!logger) {
    // Fallback if middleware wasn't applied (shouldn't happen in production)
    console.warn("[logger] No logger in context, using console fallback");
    return createConsoleLogger({ path: c.req.path });
  }
  return logger;
}

// =============================================================================
// Standalone Logger (for utilities without Hono context)
// =============================================================================

/**
 * Create a standalone logger for use outside of request handlers
 * Requires env and executionCtx to be passed explicitly
 *
 * Usage:
 *   const log = createStandaloneLogger(env, ctx, { component: "cron" })
 */
export function createStandaloneLogger(
  env: Env,
  ctx: ExecutionContext,
  baseContext?: LogContext
): Logger {
  if (env.LOGS) {
    return createLogger(env.LOGS as unknown as LogsRPC, ctx, baseContext);
  }
  return createConsoleLogger(baseContext);
}

// =============================================================================
// Utility Logger (for code without Hono context)
// =============================================================================

/**
 * Console logger for utility functions that don't have access to Hono context.
 * Prefer getLogger(c) in request handlers when context is available.
 */
export const log = createConsoleLogger();
