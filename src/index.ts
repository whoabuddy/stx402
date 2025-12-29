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
import { StacksFtBalance } from "./endpoints/stacksFtBalance";
import { StacksNftHoldings } from "./endpoints/stacksNftHoldings";
import { StacksTxStatus } from "./endpoints/stacksTxStatus";

// AI endpoints
import { DadJoke } from "./endpoints/dadJoke";
import { ImageDescribe } from "./endpoints/imageDescribe";
import { Tts } from "./endpoints/tts";
import { Summarize } from "./endpoints/summarize";
import { GenerateImage } from "./endpoints/generateImage";
import { AiExplainContract } from "./endpoints/aiExplainContract";
import { AiTranslate } from "./endpoints/aiTranslate";
import { AiSentiment } from "./endpoints/aiSentiment";

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
import { TextUrlEncode } from "./endpoints/textUrlEncode";
import { TextUrlDecode } from "./endpoints/textUrlDecode";
import { TextJwtDecode } from "./endpoints/textJwtDecode";
import { TextHmac } from "./endpoints/textHmac";
import { TextHtmlEncode } from "./endpoints/textHtmlEncode";
import { TextHtmlDecode } from "./endpoints/textHtmlDecode";
import { TextHexEncode } from "./endpoints/textHexEncode";
import { TextHexDecode } from "./endpoints/textHexDecode";
import { TextCaseConvert } from "./endpoints/textCaseConvert";
import { TextSlug } from "./endpoints/textSlug";
import { TextWordCount } from "./endpoints/textWordCount";
import { TextReverse } from "./endpoints/textReverse";
import { TextTruncate } from "./endpoints/textTruncate";
import { TextRegexTest } from "./endpoints/textRegexTest";

// Data endpoints
import { DataCsvToJson } from "./endpoints/dataCsvToJson";
import { DataJsonToCsv } from "./endpoints/dataJsonToCsv";

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
openapi.get("/api/stacks/ft-balance/:address", paymentMiddleware, trackMetrics, StacksFtBalance as any);
openapi.get("/api/stacks/nft-holdings/:address", paymentMiddleware, trackMetrics, StacksNftHoldings as any);
openapi.get("/api/stacks/tx-status/:txid", paymentMiddleware, trackMetrics, StacksTxStatus as any);

// AI endpoints (paid)
openapi.get("/api/ai/dad-joke", paymentMiddleware, trackMetrics, DadJoke as any);
openapi.post("/api/ai/image-describe", paymentMiddleware, trackMetrics, ImageDescribe as any);
openapi.post("/api/ai/tts", paymentMiddleware, trackMetrics, Tts as any);
openapi.post("/api/ai/summarize", paymentMiddleware, trackMetrics, Summarize as any);
openapi.post("/api/ai/generate-image", paymentMiddleware, trackMetrics, GenerateImage as any);
openapi.get("/api/ai/explain-contract/:contract_id", paymentMiddleware, trackMetrics, AiExplainContract as any);
openapi.post("/api/ai/translate", paymentMiddleware, trackMetrics, AiTranslate as any);
openapi.post("/api/ai/sentiment", paymentMiddleware, trackMetrics, AiSentiment as any);

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
openapi.post("/api/text/url-encode", paymentMiddleware, trackMetrics, TextUrlEncode as any);
openapi.post("/api/text/url-decode", paymentMiddleware, trackMetrics, TextUrlDecode as any);
openapi.post("/api/text/jwt-decode", paymentMiddleware, trackMetrics, TextJwtDecode as any);
openapi.post("/api/text/hmac", paymentMiddleware, trackMetrics, TextHmac as any);
openapi.post("/api/text/html-encode", paymentMiddleware, trackMetrics, TextHtmlEncode as any);
openapi.post("/api/text/html-decode", paymentMiddleware, trackMetrics, TextHtmlDecode as any);
openapi.post("/api/text/hex-encode", paymentMiddleware, trackMetrics, TextHexEncode as any);
openapi.post("/api/text/hex-decode", paymentMiddleware, trackMetrics, TextHexDecode as any);
openapi.post("/api/text/case-convert", paymentMiddleware, trackMetrics, TextCaseConvert as any);
openapi.post("/api/text/slug", paymentMiddleware, trackMetrics, TextSlug as any);
openapi.post("/api/text/word-count", paymentMiddleware, trackMetrics, TextWordCount as any);
openapi.post("/api/text/reverse", paymentMiddleware, trackMetrics, TextReverse as any);
openapi.post("/api/text/truncate", paymentMiddleware, trackMetrics, TextTruncate as any);
openapi.post("/api/text/regex-test", paymentMiddleware, trackMetrics, TextRegexTest as any);

// Data endpoints (paid)
openapi.post("/api/data/csv-to-json", paymentMiddleware, trackMetrics, DataCsvToJson as any);
openapi.post("/api/data/json-to-csv", paymentMiddleware, trackMetrics, DataJsonToCsv as any);

// Utility endpoints (paid)
openapi.get("/api/util/timestamp", paymentMiddleware, trackMetrics, UtilTimestamp as any);
openapi.get("/api/util/dns-lookup", paymentMiddleware, trackMetrics, UtilDnsLookup as any);
openapi.get("/api/util/ip-info", paymentMiddleware, trackMetrics, UtilIpInfo as any);
openapi.post("/api/util/qr-generate", paymentMiddleware, trackMetrics, UtilQrGenerate as any);

// Export the Hono app
export default app;
