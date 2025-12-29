import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Health endpoints
import { Health } from "./endpoints/health";
import { Dashboard } from "./endpoints/dashboard";

// Stacks endpoints
import { GetBnsName } from "./endpoints/getBnsName";
import { ValidateStacksAddress } from "./endpoints/validateStacksAddress";
import { ConvertAddressToNetwork } from "./endpoints/convertAddressToNetwork";
import { DecodeClarityHex } from "./endpoints/decodeClarityHex";
import { StacksContractSource } from "./endpoints/stacksContractSource";
import { StacksContractAbi } from "./endpoints/stacksContractAbi";
import { StacksToConsensusBuff } from "./endpoints/stacksToConsensusBuff";
import { StacksFromConsensusBuff } from "./endpoints/stacksFromConsensusBuff";
import { StacksDecodeTx } from "./endpoints/stacksDecodeTx";
import { StacksCallReadonly } from "./endpoints/stacksCallReadonly";
import { StacksStxBalance } from "./endpoints/stacksStxBalance";
import { StacksBlockHeight } from "./endpoints/stacksBlockHeight";

// AI endpoints
import { DadJoke } from "./endpoints/dadJoke";
import { ImageDescribe } from "./endpoints/imageDescribe";
import { Tts } from "./endpoints/tts";
import { Summarize } from "./endpoints/summarize";
import { GenerateImage } from "./endpoints/generateImage";
import { AiExplainContract } from "./endpoints/aiExplainContract";
import { AiTranslate } from "./endpoints/aiTranslate";

// Random endpoints
import { RandomUuid } from "./endpoints/randomUuid";
import { RandomNumber } from "./endpoints/randomNumber";
import { RandomString } from "./endpoints/randomString";

// Text endpoints
import { TextBase64Encode } from "./endpoints/textBase64Encode";
import { TextBase64Decode } from "./endpoints/textBase64Decode";
import { TextSha256 } from "./endpoints/textSha256";
import { TextSha512 } from "./endpoints/textSha512";
import { TextKeccak256 } from "./endpoints/textKeccak256";
import { TextHash160 } from "./endpoints/textHash160";

// Utility endpoints
import { UtilTimestamp } from "./endpoints/utilTimestamp";
import { UtilDnsLookup } from "./endpoints/utilDnsLookup";
import { UtilIpInfo } from "./endpoints/utilIpInfo";
import { UtilQrGenerate } from "./endpoints/utilQrGenerate";

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

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

const paymentMiddleware = x402PaymentMiddleware();
const trackMetrics = metricsMiddleware();

// Register OpenAPI endpoints

// Health endpoints (free)
openapi.get("/api/health", Health);
openapi.get("/dashboard", Dashboard);

// Stacks endpoints (paid)
openapi.get("/api/stacks/get-bns-name/:address", paymentMiddleware, trackMetrics, GetBnsName as any);
openapi.get(
  "/api/stacks/validate-address/:address",
  paymentMiddleware,
  trackMetrics,
  ValidateStacksAddress as any
);
openapi.get(
  "/api/stacks/convert-address/:address",
  paymentMiddleware,
  trackMetrics,
  ConvertAddressToNetwork as any
);
openapi.post(
  "/api/stacks/decode-clarity-hex",
  paymentMiddleware,
  trackMetrics,
  DecodeClarityHex as any
);
openapi.get(
  "/api/stacks/contract-source/:contract_id",
  paymentMiddleware,
  trackMetrics,
  StacksContractSource as any
);
openapi.get(
  "/api/stacks/contract-abi/:contract_id",
  paymentMiddleware,
  trackMetrics,
  StacksContractAbi as any
);
openapi.post("/api/stacks/to-consensus-buff", paymentMiddleware, trackMetrics, StacksToConsensusBuff as any);
openapi.post("/api/stacks/from-consensus-buff", paymentMiddleware, trackMetrics, StacksFromConsensusBuff as any);
openapi.post("/api/stacks/decode-tx", paymentMiddleware, trackMetrics, StacksDecodeTx as any);
openapi.post("/api/stacks/call-readonly", paymentMiddleware, trackMetrics, StacksCallReadonly as any);
openapi.get("/api/stacks/stx-balance/:address", paymentMiddleware, trackMetrics, StacksStxBalance as any);
openapi.get("/api/stacks/block-height", paymentMiddleware, trackMetrics, StacksBlockHeight as any);

// AI endpoints (paid)
openapi.get("/api/ai/dad-joke", paymentMiddleware, trackMetrics, DadJoke as any);
openapi.post("/api/ai/image-describe", paymentMiddleware, trackMetrics, ImageDescribe as any);
openapi.post("/api/ai/tts", paymentMiddleware, trackMetrics, Tts as any);
openapi.post("/api/ai/summarize", paymentMiddleware, trackMetrics, Summarize as any);
openapi.post("/api/ai/generate-image", paymentMiddleware, trackMetrics, GenerateImage as any);
openapi.get("/api/ai/explain-contract/:contract_id", paymentMiddleware, trackMetrics, AiExplainContract as any);
openapi.post("/api/ai/translate", paymentMiddleware, trackMetrics, AiTranslate as any);

// Random endpoints (paid)
openapi.get("/api/random/uuid", paymentMiddleware, trackMetrics, RandomUuid as any);
openapi.get("/api/random/number", paymentMiddleware, trackMetrics, RandomNumber as any);
openapi.get("/api/random/string", paymentMiddleware, trackMetrics, RandomString as any);

// Text endpoints (paid)
openapi.post("/api/text/base64-encode", paymentMiddleware, trackMetrics, TextBase64Encode as any);
openapi.post("/api/text/base64-decode", paymentMiddleware, trackMetrics, TextBase64Decode as any);
openapi.post("/api/text/sha256", paymentMiddleware, trackMetrics, TextSha256 as any);
openapi.post("/api/text/sha512", paymentMiddleware, trackMetrics, TextSha512 as any);
openapi.post("/api/text/keccak256", paymentMiddleware, trackMetrics, TextKeccak256 as any);
openapi.post("/api/text/hash160", paymentMiddleware, trackMetrics, TextHash160 as any);

// Utility endpoints (paid)
openapi.get("/api/util/timestamp", paymentMiddleware, trackMetrics, UtilTimestamp as any);
openapi.get("/api/util/dns-lookup", paymentMiddleware, trackMetrics, UtilDnsLookup as any);
openapi.get("/api/util/ip-info", paymentMiddleware, trackMetrics, UtilIpInfo as any);
openapi.post("/api/util/qr-generate", paymentMiddleware, trackMetrics, UtilQrGenerate as any);

// Export the Hono app
export default app;
