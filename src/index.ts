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

// Health endpoints
import { Health } from "./endpoints/health";
import { Dashboard } from "./endpoints/dashboard";
import { AboutPage } from "./endpoints/about";
import { GuidePage } from "./endpoints/guide";
import { ToolboxPage } from "./endpoints/toolbox";

// Stacks endpoints (Clarity utilities + aggregated endpoints)
import { ConvertAddressToNetwork } from "./endpoints/convertAddressToNetwork";
import { DecodeClarityHex } from "./endpoints/decodeClarityHex";
import { StacksToConsensusBuff } from "./endpoints/stacksToConsensusBuff";
import { StacksFromConsensusBuff } from "./endpoints/stacksFromConsensusBuff";
import { StacksDecodeTx } from "./endpoints/stacksDecodeTx";
import { StacksProfile } from "./endpoints/stacksProfile";
import { StacksContractInfo } from "./endpoints/stacksContractInfo";
import { SbtcTreasury } from "./endpoints/sbtcTreasury";

// AI endpoints
import { DadJoke } from "./endpoints/dadJoke";
import { ImageDescribe } from "./endpoints/imageDescribe";
import { Tts } from "./endpoints/tts";
import { Summarize } from "./endpoints/summarize";
import { GenerateImage } from "./endpoints/generateImage";
import { AiExplainContract } from "./endpoints/aiExplainContract";
import { AiTranslate } from "./endpoints/aiTranslate";
import { AiSentiment } from "./endpoints/aiSentiment";
import { AiKeywords } from "./endpoints/aiKeywords";
import { AiLanguageDetect } from "./endpoints/aiLanguageDetect";
import { AiParaphrase } from "./endpoints/aiParaphrase";
import { AiGrammarCheck } from "./endpoints/aiGrammarCheck";
import { AiQuestionAnswer } from "./endpoints/aiQuestionAnswer";

// Hash endpoints
import {
  HashSha256,
  HashSha512,
  HashKeccak256,
  HashHash160,
  HashRipemd160,
  HashHmac,
} from "./endpoints/hash";

// Data endpoints (free)
import { DataJsonMinify } from "./endpoints/dataJsonMinify";
import { DataJsonValidate } from "./endpoints/dataJsonValidate";

// Utility endpoints (paid)
import { UtilQrGenerate } from "./endpoints/utilQrGenerate";
import { UtilVerifySignature } from "./endpoints/utilVerifySignature";

// Registry endpoints
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

// KV Storage endpoints
import { KvSet, KvGet, KvDelete, KvList } from "./endpoints/kv";

// Paste endpoints
import { PasteCreate, PasteGet, PasteDelete } from "./endpoints/paste";

// Counter endpoints (Durable Objects)
import {
  CounterIncrement,
  CounterDecrement,
  CounterGet,
  CounterReset,
  CounterList,
  CounterDelete,
} from "./endpoints/counter";

// SQL endpoints (Durable Objects)
import { SqlQuery, SqlExecute, SqlSchema } from "./endpoints/sql";

// Links endpoints (Durable Objects)
import {
  LinksCreate,
  LinksExpand,
  LinksStats,
  LinksDelete,
  LinksList,
} from "./endpoints/links";

// Sync endpoints (Durable Objects - Distributed Locks)
import {
  SyncLock,
  SyncUnlock,
  SyncCheck,
  SyncExtend,
  SyncList,
} from "./endpoints/sync";

// Queue endpoints (Durable Objects - Job Queue)
import {
  QueuePush,
  QueuePop,
  QueueComplete,
  QueueFail,
  QueueStatus,
} from "./endpoints/queue";

// Memory endpoints (Durable Objects - Agent Memory System)
import {
  MemoryStore,
  MemoryRecall,
  MemorySearch,
  MemoryList,
  MemoryForget,
} from "./endpoints/memory";

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

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["X-PAYMENT", "X-PAYMENT-TOKEN-TYPE"],
  })
);

// Serve themed Scalar API docs at root (aibtc.com branding)
app.get("/", (c) => c.html(getScalarHTML("/openapi.json")));

// Serve favicon
app.get("/favicon.svg", () => getFaviconSVG());
app.get("/favicon.ico", () => getFaviconSVG()); // Browsers also request .ico

// Setup OpenAPI registry (disable built-in Swagger UI, we use Scalar)
const openapi = fromHono(app, {
  docs_url: null,
  openapi_url: "/openapi.json",
  schema: {
    info: {
      title: "STX402 API",
      version: "1.0.0",
      description: "X402 micropayment-gated API endpoints on Stacks. Pay-per-use with STX, sBTC, or USDCx.",
    },
  },
});

const paymentMiddleware = x402PaymentMiddleware();
const trackMetrics = metricsMiddleware();

// Register OpenAPI endpoints

// Health endpoints (free)
openapi.get("/api/health", Health);
openapi.get("/dashboard", Dashboard);
openapi.get("/about", AboutPage);
openapi.get("/guide", GuidePage);
openapi.get("/toolbox", ToolboxPage);

// Free utility endpoints
openapi.post("/api/data/json-minify", DataJsonMinify as any);
openapi.post("/api/data/json-validate", DataJsonValidate as any);

// Stacks endpoints (paid) - Clarity utilities + aggregated endpoints
openapi.get("/api/stacks/convert-address/:address", paymentMiddleware, trackMetrics, ConvertAddressToNetwork as any);
openapi.post("/api/stacks/decode-clarity-hex", paymentMiddleware, trackMetrics, DecodeClarityHex as any);
openapi.post("/api/stacks/to-consensus-buff", paymentMiddleware, trackMetrics, StacksToConsensusBuff as any);
openapi.post("/api/stacks/from-consensus-buff", paymentMiddleware, trackMetrics, StacksFromConsensusBuff as any);
openapi.post("/api/stacks/decode-tx", paymentMiddleware, trackMetrics, StacksDecodeTx as any);
openapi.get("/api/stacks/profile/:address", paymentMiddleware, trackMetrics, StacksProfile as any);
openapi.get("/api/stacks/contract-info/:contract_id", paymentMiddleware, trackMetrics, StacksContractInfo as any);

// sBTC endpoints (paid)
openapi.get("/api/sbtc/treasury/:address", paymentMiddleware, trackMetrics, SbtcTreasury as any);

// AI endpoints (paid)
openapi.get("/api/ai/dad-joke", paymentMiddleware, trackMetrics, DadJoke as any);
openapi.post("/api/ai/image-describe", paymentMiddleware, trackMetrics, ImageDescribe as any);
openapi.post("/api/ai/tts", paymentMiddleware, trackMetrics, Tts as any);
openapi.post("/api/ai/summarize", paymentMiddleware, trackMetrics, Summarize as any);
openapi.post("/api/ai/generate-image", paymentMiddleware, trackMetrics, GenerateImage as any);
openapi.get("/api/ai/explain-contract/:contract_id", paymentMiddleware, trackMetrics, AiExplainContract as any);
openapi.post("/api/ai/translate", paymentMiddleware, trackMetrics, AiTranslate as any);
openapi.post("/api/ai/sentiment", paymentMiddleware, trackMetrics, AiSentiment as any);
openapi.post("/api/ai/keywords", paymentMiddleware, trackMetrics, AiKeywords as any);
openapi.post("/api/ai/language-detect", paymentMiddleware, trackMetrics, AiLanguageDetect as any);
openapi.post("/api/ai/paraphrase", paymentMiddleware, trackMetrics, AiParaphrase as any);
openapi.post("/api/ai/grammar-check", paymentMiddleware, trackMetrics, AiGrammarCheck as any);
openapi.post("/api/ai/question-answer", paymentMiddleware, trackMetrics, AiQuestionAnswer as any);

// Hash endpoints (paid)
openapi.post("/api/hash/sha256", paymentMiddleware, trackMetrics, HashSha256 as any);
openapi.post("/api/hash/sha512", paymentMiddleware, trackMetrics, HashSha512 as any);
openapi.post("/api/hash/keccak256", paymentMiddleware, trackMetrics, HashKeccak256 as any);
openapi.post("/api/hash/hash160", paymentMiddleware, trackMetrics, HashHash160 as any);
openapi.post("/api/hash/ripemd160", paymentMiddleware, trackMetrics, HashRipemd160 as any);
openapi.post("/api/hash/hmac", paymentMiddleware, trackMetrics, HashHmac as any);

// Utility endpoints (paid)
openapi.post("/api/util/qr-generate", paymentMiddleware, trackMetrics, UtilQrGenerate as any);
openapi.post("/api/util/verify-signature", paymentMiddleware, trackMetrics, UtilVerifySignature as any);

// Registry endpoints
openapi.post("/api/registry/probe", paymentMiddleware, trackMetrics, RegistryProbe as any);
openapi.post("/api/registry/register", paymentMiddleware, trackMetrics, RegistryRegister as any);
openapi.get("/api/registry/list", RegistryList as any); // Free endpoint
openapi.post("/api/registry/details", paymentMiddleware, trackMetrics, RegistryDetails as any);
openapi.post("/api/registry/update", paymentMiddleware, trackMetrics, RegistryUpdate as any);
openapi.post("/api/registry/delete", paymentMiddleware, trackMetrics, RegistryDelete as any);
openapi.post("/api/registry/my-endpoints", paymentMiddleware, trackMetrics, RegistryMyEndpoints as any);
openapi.post("/api/registry/transfer", paymentMiddleware, trackMetrics, RegistryTransfer as any);
openapi.post("/api/admin/registry/verify", RegistryAdminVerify as any); // Free - admin auth required
openapi.post("/api/admin/registry/pending", RegistryAdminPending as any); // Free - admin auth required

// KV Storage endpoints (paid)
openapi.post("/api/kv/set", paymentMiddleware, trackMetrics, KvSet as any);
openapi.post("/api/kv/get", paymentMiddleware, trackMetrics, KvGet as any);
openapi.post("/api/kv/delete", paymentMiddleware, trackMetrics, KvDelete as any);
openapi.post("/api/kv/list", paymentMiddleware, trackMetrics, KvList as any);

// Paste endpoints (paid)
openapi.post("/api/paste/create", paymentMiddleware, trackMetrics, PasteCreate as any);
openapi.get("/api/paste/:code", paymentMiddleware, trackMetrics, PasteGet as any);
openapi.post("/api/paste/delete", paymentMiddleware, trackMetrics, PasteDelete as any);

// Counter endpoints (paid - Durable Objects)
openapi.post("/api/counter/increment", paymentMiddleware, trackMetrics, CounterIncrement as any);
openapi.post("/api/counter/decrement", paymentMiddleware, trackMetrics, CounterDecrement as any);
openapi.get("/api/counter/get", paymentMiddleware, trackMetrics, CounterGet as any);
openapi.post("/api/counter/reset", paymentMiddleware, trackMetrics, CounterReset as any);
openapi.get("/api/counter/list", paymentMiddleware, trackMetrics, CounterList as any);
openapi.post("/api/counter/delete", paymentMiddleware, trackMetrics, CounterDelete as any);

// SQL endpoints (paid - Durable Objects)
openapi.post("/api/sql/query", paymentMiddleware, trackMetrics, SqlQuery as any);
openapi.post("/api/sql/execute", paymentMiddleware, trackMetrics, SqlExecute as any);
openapi.get("/api/sql/schema", paymentMiddleware, trackMetrics, SqlSchema as any);

// Links endpoints (paid - Durable Objects URL Shortener)
openapi.post("/api/links/create", paymentMiddleware, trackMetrics, LinksCreate as any);
openapi.get("/api/links/expand/:slug", LinksExpand as any); // Free expand (tracking included)
openapi.post("/api/links/stats", paymentMiddleware, trackMetrics, LinksStats as any);
openapi.post("/api/links/delete", paymentMiddleware, trackMetrics, LinksDelete as any);
openapi.get("/api/links/list", paymentMiddleware, trackMetrics, LinksList as any);

// Sync endpoints (paid - Durable Objects Distributed Locks)
openapi.post("/api/sync/lock", paymentMiddleware, trackMetrics, SyncLock as any);
openapi.post("/api/sync/unlock", paymentMiddleware, trackMetrics, SyncUnlock as any);
openapi.post("/api/sync/check", paymentMiddleware, trackMetrics, SyncCheck as any);
openapi.post("/api/sync/extend", paymentMiddleware, trackMetrics, SyncExtend as any);
openapi.get("/api/sync/list", paymentMiddleware, trackMetrics, SyncList as any);

// Queue endpoints (paid - Durable Objects Job Queue)
openapi.post("/api/queue/push", paymentMiddleware, trackMetrics, QueuePush as any);
openapi.post("/api/queue/pop", paymentMiddleware, trackMetrics, QueuePop as any);
openapi.post("/api/queue/complete", paymentMiddleware, trackMetrics, QueueComplete as any);
openapi.post("/api/queue/fail", paymentMiddleware, trackMetrics, QueueFail as any);
openapi.post("/api/queue/status", paymentMiddleware, trackMetrics, QueueStatus as any);

// Memory endpoints (paid - Durable Objects Agent Memory System)
openapi.post("/api/memory/store", paymentMiddleware, trackMetrics, MemoryStore as any);
openapi.post("/api/memory/recall", paymentMiddleware, trackMetrics, MemoryRecall as any);
openapi.post("/api/memory/search", paymentMiddleware, trackMetrics, MemorySearch as any);
openapi.post("/api/memory/list", paymentMiddleware, trackMetrics, MemoryList as any);
openapi.post("/api/memory/forget", paymentMiddleware, trackMetrics, MemoryForget as any);

// Agent Registry endpoints (ERC-8004)
// Meta endpoints
openapi.get("/api/agent/registry", RegistryInfo as any); // Free endpoint
// Identity Registry
openapi.post("/api/agent/info", paymentMiddleware, trackMetrics, AgentInfo as any);
openapi.get("/api/agent/owner", paymentMiddleware, trackMetrics, AgentOwner as any);
openapi.get("/api/agent/uri", paymentMiddleware, trackMetrics, AgentUri as any);
openapi.post("/api/agent/metadata", paymentMiddleware, trackMetrics, AgentMetadata as any);
openapi.get("/api/agent/version", paymentMiddleware, trackMetrics, AgentVersion as any);
openapi.post("/api/agent/lookup", paymentMiddleware, trackMetrics, AgentLookup as any);
// Reputation Registry
openapi.post("/api/agent/reputation/summary", paymentMiddleware, trackMetrics, ReputationSummary as any);
openapi.post("/api/agent/reputation/feedback", paymentMiddleware, trackMetrics, ReputationFeedback as any);
openapi.post("/api/agent/reputation/list", paymentMiddleware, trackMetrics, ReputationList as any);
openapi.post("/api/agent/reputation/clients", paymentMiddleware, trackMetrics, ReputationClients as any);
openapi.post("/api/agent/reputation/auth-hash", paymentMiddleware, trackMetrics, ReputationAuthHash as any);
// Validation Registry
openapi.post("/api/agent/validation/status", paymentMiddleware, trackMetrics, ValidationStatus as any);
openapi.post("/api/agent/validation/summary", paymentMiddleware, trackMetrics, ValidationSummary as any);
openapi.post("/api/agent/validation/list", paymentMiddleware, trackMetrics, ValidationList as any);
openapi.post("/api/agent/validation/requests", paymentMiddleware, trackMetrics, ValidationRequests as any);

// Export the Hono app
export default app;
