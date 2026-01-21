// Polyfill BigInt.toJSON for JSON.stringify compatibility (stacks.js uses BigInt extensively)
// This must be at the top before any other imports that might use BigInt
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getFaviconSVG } from "./endpoints/favicon";

// Health/Info endpoints
import { Health } from "./endpoints/health";
import { Dashboard } from "./endpoints/dashboard";
import { GuidePage } from "./endpoints/guide";
import { ToolboxPage } from "./endpoints/toolbox";
import { X402WellKnown } from "./endpoints/x402WellKnown";

// Registry endpoints (X402 Directory)
import { RegistryProbe } from "./endpoints/registryProbe";
import { RegistryRegister } from "./endpoints/registryRegister";
import { RegistryList } from "./endpoints/registryList";
import { RegistryDetails } from "./endpoints/registryDetails";
import { RegistryUpdate } from "./endpoints/registryUpdate";
import { RegistryDelete } from "./endpoints/registryDelete";
import { RegistryAdminVerify } from "./endpoints/registryAdminVerify";
import { RegistryAdminPending } from "./endpoints/registryAdminPending";
import { RegistryMyEndpoints } from "./endpoints/registryMyEndpoints";
import { RegistryTransfer } from "./endpoints/registryTransfer";

// Links endpoints (Durable Objects - URL Shortener)
import {
  LinksCreate,
  LinksExpand,
  LinksStats,
  LinksDelete,
  LinksList,
} from "./endpoints/links";

// Agent Registry endpoints (ERC-8004)
import {
  AgentInfo,
  AgentOwner,
  AgentUri,
  AgentMetadata,
  AgentVersion,
  ReputationSummary,
  ReputationFeedback,
  ReputationList,
  ReputationClients,
  ReputationAuthHash,
  ValidationStatus,
  ValidationSummary,
  ValidationList,
  ValidationRequests,
  RegistryInfo,
  AgentLookup,
} from "./endpoints/agent";

// Durable Objects
export { UserDurableObject } from "./durable-objects/UserDurableObject";

import { x402PaymentMiddleware } from "./middleware/x402-stacks";
import { metricsMiddleware } from "./middleware/metrics";
import { loggerMiddleware } from "./utils/logger";
import type { AppVariables } from "./types";

// Start a Hono app
const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    // V2 headers (lowercase for HTTP/2 compatibility)
    allowHeaders: ["payment-signature", "payment-required", "payment-response"],
  })
);

// Logger middleware - creates logger with CF-Ray ID and stores in context
app.use("/*", loggerMiddleware);

// JSON service info at root (matches aibtc convention)
app.get("/", (c) => {
  return c.json({
    service: "stx402-directory",
    version: "2.0.0",
    description: "The X402 Directory - Endpoint registry and ERC-8004 agent interface",
    docs: "/docs",
    categories: {
      registry: "/registry/* - X402 endpoint directory",
      agent: "/agent/* - ERC-8004 agent registry on Stacks",
      links: "/links/* - URL shortener with analytics",
    },
    payment: {
      x402Version: 2,
      tokens: ["STX", "sBTC", "USDCx"],
      requestHeader: "payment-signature",
      responseHeader: "payment-response",
    },
    related: {
      utilities: "https://x402.aibtc.com",
      documentation: "https://stx402.com/docs",
    },
  });
});

// Serve favicon
app.get("/favicon.svg", () => getFaviconSVG());
app.get("/favicon.ico", () => getFaviconSVG()); // Browsers also request .ico

// Setup OpenAPI registry with Swagger UI
const openapi = fromHono(app, {
  docs_url: "/docs",
  openapi_url: "/openapi.json",
  schema: {
    info: {
      title: "STX402 Directory API",
      version: "2.0.0",
      description: `
The X402 Directory - Meta layer for the X402 ecosystem.

## Purpose
- **Registry**: Discover and register X402-compatible endpoints
- **Agent**: ERC-8004 agent identity, reputation, and validation on Stacks
- **Links**: URL shortener with click tracking

## Payment (X402 V2)
All paid endpoints use the X402 V2 protocol. Request without payment to receive a 402 response with payment requirements. Submit payment via the \`payment-signature\` header (base64-encoded JSON). Successful responses include \`payment-response\` header.
Supported tokens: STX, sBTC, USDCx.

## Related
For general utilities, storage, and inference: https://x402.aibtc.com
      `.trim(),
    },
    tags: [
      { name: "Health", description: "Service health checks" },
      { name: "System", description: "System pages and documentation" },
      { name: "Info", description: "Service information and documentation" },
      { name: "Registry", description: "X402 endpoint directory" },
      { name: "Registry Admin", description: "Admin operations for registry verification" },
      { name: "Links", description: "URL shortener with analytics" },
      { name: "Agent Registry", description: "ERC-8004 agent identity, reputation, and validation on Stacks" },
    ],
    servers: [
      { url: "https://stx402.com", description: "Production (mainnet)" },
    ],
  },
});

const paymentMiddleware = x402PaymentMiddleware();
const trackMetrics = metricsMiddleware();

// =============================================================================
// Info Endpoints (free)
// =============================================================================

openapi.get("/health", Health);
openapi.get("/dashboard", Dashboard);
openapi.get("/guide", GuidePage);
openapi.get("/toolbox", ToolboxPage);
openapi.get("/x402.json", X402WellKnown);

// =============================================================================
// Registry Endpoints (X402 Directory)
// =============================================================================

openapi.post("/registry/probe", paymentMiddleware, trackMetrics, RegistryProbe as any);
openapi.post("/registry/register", paymentMiddleware, trackMetrics, RegistryRegister as any);
openapi.get("/registry/list", RegistryList as any); // Free endpoint
openapi.post("/registry/details", paymentMiddleware, trackMetrics, RegistryDetails as any);
openapi.post("/registry/update", paymentMiddleware, trackMetrics, RegistryUpdate as any);
openapi.post("/registry/delete", paymentMiddleware, trackMetrics, RegistryDelete as any);
openapi.post("/registry/my-endpoints", paymentMiddleware, trackMetrics, RegistryMyEndpoints as any);
openapi.post("/registry/transfer", paymentMiddleware, trackMetrics, RegistryTransfer as any);
openapi.post("/admin/registry/verify", RegistryAdminVerify as any); // Free - admin auth required
openapi.post("/admin/registry/pending", RegistryAdminPending as any); // Free - admin auth required

// =============================================================================
// Links Endpoints (URL Shortener)
// =============================================================================

openapi.post("/links/create", paymentMiddleware, trackMetrics, LinksCreate as any);
openapi.get("/links/expand/:slug", LinksExpand as any); // Free expand (tracking included)
openapi.post("/links/stats", paymentMiddleware, trackMetrics, LinksStats as any);
openapi.post("/links/delete", paymentMiddleware, trackMetrics, LinksDelete as any);
openapi.get("/links/list", paymentMiddleware, trackMetrics, LinksList as any);

// =============================================================================
// Agent Registry Endpoints (ERC-8004)
// =============================================================================

// Meta (free)
openapi.get("/agent/registry", RegistryInfo as any);

// Identity Registry
openapi.post("/agent/info", paymentMiddleware, trackMetrics, AgentInfo as any);
openapi.get("/agent/owner", paymentMiddleware, trackMetrics, AgentOwner as any);
openapi.get("/agent/uri", paymentMiddleware, trackMetrics, AgentUri as any);
openapi.post("/agent/metadata", paymentMiddleware, trackMetrics, AgentMetadata as any);
openapi.get("/agent/version", paymentMiddleware, trackMetrics, AgentVersion as any);
openapi.post("/agent/lookup", paymentMiddleware, trackMetrics, AgentLookup as any);

// Reputation Registry
openapi.post("/agent/reputation/summary", paymentMiddleware, trackMetrics, ReputationSummary as any);
openapi.post("/agent/reputation/feedback", paymentMiddleware, trackMetrics, ReputationFeedback as any);
openapi.post("/agent/reputation/list", paymentMiddleware, trackMetrics, ReputationList as any);
openapi.post("/agent/reputation/clients", paymentMiddleware, trackMetrics, ReputationClients as any);
openapi.post("/agent/reputation/auth-hash", paymentMiddleware, trackMetrics, ReputationAuthHash as any);

// Validation Registry
openapi.post("/agent/validation/status", paymentMiddleware, trackMetrics, ValidationStatus as any);
openapi.post("/agent/validation/summary", paymentMiddleware, trackMetrics, ValidationSummary as any);
openapi.post("/agent/validation/list", paymentMiddleware, trackMetrics, ValidationList as any);
openapi.post("/agent/validation/requests", paymentMiddleware, trackMetrics, ValidationRequests as any);

// Export the Hono app
export default app;
