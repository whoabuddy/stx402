// Polyfill BigInt.toJSON for JSON.stringify compatibility (stacks.js uses BigInt extensively)
// This must be at the top before any other imports that might use BigInt
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getScalarHTML } from "./endpoints/scalarDocs";
import { getFaviconSVG } from "./endpoints/favicon";

// Health/Info endpoints
import { Health } from "./endpoints/health";
import { Dashboard } from "./endpoints/dashboard";
import { AboutPage } from "./endpoints/about";
import { GuidePage } from "./endpoints/guide";
import { ToolboxPage } from "./endpoints/toolbox";

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
    allowHeaders: ["X-PAYMENT", "X-PAYMENT-TOKEN-TYPE"],
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
      tokens: ["STX", "sBTC", "USDCx"],
      header: "X-PAYMENT",
      tokenTypeHeader: "X-PAYMENT-TOKEN-TYPE",
    },
    related: {
      workhorse: "https://x402.aibtc.com",
      documentation: "https://stx402.com/docs",
    },
  });
});

// Serve themed Scalar API docs at /docs (matches aibtc convention)
app.get("/docs", (c) => c.html(getScalarHTML("/openapi.json")));

// Serve favicon
app.get("/favicon.svg", () => getFaviconSVG());
app.get("/favicon.ico", () => getFaviconSVG()); // Browsers also request .ico

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: null,
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

## Payment
All paid endpoints require an \`X-PAYMENT\` header with a signed Stacks transaction.
Optionally specify token via \`X-PAYMENT-TOKEN-TYPE\` (STX, sBTC, USDCx).

## Related
For general utilities, storage, and inference: https://x402.aibtc.com
      `.trim(),
    },
    tags: [
      { name: "Info", description: "Service information and documentation" },
      { name: "Registry", description: "X402 endpoint directory" },
      { name: "Links", description: "URL shortener with analytics" },
      { name: "Agent - Identity", description: "ERC-8004 agent identity registry" },
      { name: "Agent - Reputation", description: "ERC-8004 agent reputation system" },
      { name: "Agent - Validation", description: "ERC-8004 agent validation tracking" },
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
openapi.get("/about", AboutPage);
openapi.get("/guide", GuidePage);
openapi.get("/toolbox", ToolboxPage);

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
