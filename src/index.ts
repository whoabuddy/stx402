// Polyfill BigInt.toJSON for JSON.stringify compatibility (stacks.js uses BigInt extensively)
// This must be at the top before any other imports that might use BigInt
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

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
import { AiKeywords } from "./endpoints/aiKeywords";
import { AiLanguageDetect } from "./endpoints/aiLanguageDetect";
import { AiParaphrase } from "./endpoints/aiParaphrase";
import { AiGrammarCheck } from "./endpoints/aiGrammarCheck";
import { AiQuestionAnswer } from "./endpoints/aiQuestionAnswer";

// Random endpoints
import { RandomUuid } from "./endpoints/randomUuid";
import { RandomNumber } from "./endpoints/randomNumber";
import { RandomString } from "./endpoints/randomString";
import { RandomPassword } from "./endpoints/randomPassword";
import { RandomColor } from "./endpoints/randomColor";
import { RandomDice } from "./endpoints/randomDice";
import { RandomShuffle } from "./endpoints/randomShuffle";

// Math endpoints
import { MathCalculate } from "./endpoints/mathCalculate";
import { MathPercentage } from "./endpoints/mathPercentage";
import { MathStatistics } from "./endpoints/mathStatistics";
import { MathPrimeCheck } from "./endpoints/mathPrimeCheck";
import { MathGcdLcm } from "./endpoints/mathGcdLcm";
import { MathFactorial } from "./endpoints/mathFactorial";

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
import { TextWordCount } from "./endpoints/textWordCount";
import { TextReverse } from "./endpoints/textReverse";
import { TextTruncate } from "./endpoints/textTruncate";
import { TextRegexTest } from "./endpoints/textRegexTest";
import { TextRot13 } from "./endpoints/textRot13";
import { TextLoremIpsum } from "./endpoints/textLoremIpsum";
import { TextValidateUrl } from "./endpoints/textValidateUrl";
import { TextDiff } from "./endpoints/textDiff";
import { TextUnicodeInfo } from "./endpoints/textUnicodeInfo";

// Data endpoints
import { DataCsvToJson } from "./endpoints/dataCsvToJson";
import { DataJsonToCsv } from "./endpoints/dataJsonToCsv";
import { DataJsonFormat } from "./endpoints/dataJsonFormat";
import { DataJsonMinify } from "./endpoints/dataJsonMinify";
import { DataJsonValidate } from "./endpoints/dataJsonValidate";
import { DataJsonPath } from "./endpoints/dataJsonPath";
import { DataJsonFlatten } from "./endpoints/dataJsonFlatten";
import { DataJsonMerge } from "./endpoints/dataJsonMerge";

// Crypto endpoints
import { CryptoRipemd160 } from "./endpoints/cryptoRipemd160";
import { CryptoRandomBytes } from "./endpoints/cryptoRandomBytes";

// Utility endpoints
import { UtilTimestamp } from "./endpoints/utilTimestamp";
import { UtilDnsLookup } from "./endpoints/utilDnsLookup";
import { UtilIpInfo } from "./endpoints/utilIpInfo";
import { UtilQrGenerate } from "./endpoints/utilQrGenerate";
import { UtilTimestampConvert } from "./endpoints/utilTimestampConvert";
import { UtilDateDiff } from "./endpoints/utilDateDiff";
import { UtilDateAdd } from "./endpoints/utilDateAdd";
import { UtilCronParse } from "./endpoints/utilCronParse";
import { UtilUserAgentParse } from "./endpoints/utilUserAgentParse";
import { UtilUrlParse } from "./endpoints/utilUrlParse";
import { UtilColorConvert } from "./endpoints/utilColorConvert";
import { UtilMarkdownToHtml } from "./endpoints/utilMarkdownToHtml";
import { UtilHttpStatus } from "./endpoints/utilHttpStatus";
import { UtilValidateEmail } from "./endpoints/utilValidateEmail";
import { UtilUrlBuild } from "./endpoints/utilUrlBuild";
import { UtilHtmlToText } from "./endpoints/utilHtmlToText";
import { UtilBase64Image } from "./endpoints/utilBase64Image";
import { UtilBytesFormat } from "./endpoints/utilBytesFormat";
import { UtilSlugify } from "./endpoints/utilSlugify";
import { UtilMimeType } from "./endpoints/utilMimeType";
import { UtilRegexEscape } from "./endpoints/utilRegexEscape";
import { UtilStringDistance } from "./endpoints/utilStringDistance";
import { UtilVerifySignature } from "./endpoints/utilVerifySignature";

// Network endpoints
import { NetGeoIp } from "./endpoints/netGeoIp";
import { NetAsnLookup } from "./endpoints/netAsnLookup";
import { NetRequestFingerprint } from "./endpoints/netRequestFingerprint";
import { NetHttpProbe } from "./endpoints/netHttpProbe";
import { NetCorsProxy } from "./endpoints/netCorsProxy";
import { NetSslCheck } from "./endpoints/netSslCheck";

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
openapi.post("/api/ai/keywords", paymentMiddleware, trackMetrics, AiKeywords as any);
openapi.post("/api/ai/language-detect", paymentMiddleware, trackMetrics, AiLanguageDetect as any);
openapi.post("/api/ai/paraphrase", paymentMiddleware, trackMetrics, AiParaphrase as any);
openapi.post("/api/ai/grammar-check", paymentMiddleware, trackMetrics, AiGrammarCheck as any);
openapi.post("/api/ai/question-answer", paymentMiddleware, trackMetrics, AiQuestionAnswer as any);

// Random endpoints (paid)
openapi.get("/api/random/uuid", paymentMiddleware, trackMetrics, RandomUuid as any);
openapi.get("/api/random/number", paymentMiddleware, trackMetrics, RandomNumber as any);
openapi.get("/api/random/string", paymentMiddleware, trackMetrics, RandomString as any);
openapi.get("/api/random/password", paymentMiddleware, trackMetrics, RandomPassword as any);
openapi.get("/api/random/color", paymentMiddleware, trackMetrics, RandomColor as any);
openapi.get("/api/random/dice", paymentMiddleware, trackMetrics, RandomDice as any);
openapi.post("/api/random/shuffle", paymentMiddleware, trackMetrics, RandomShuffle as any);

// Math endpoints (paid)
openapi.post("/api/math/calculate", paymentMiddleware, trackMetrics, MathCalculate as any);
openapi.post("/api/math/percentage", paymentMiddleware, trackMetrics, MathPercentage as any);
openapi.post("/api/math/statistics", paymentMiddleware, trackMetrics, MathStatistics as any);
openapi.get("/api/math/prime-check", paymentMiddleware, trackMetrics, MathPrimeCheck as any);
openapi.post("/api/math/gcd-lcm", paymentMiddleware, trackMetrics, MathGcdLcm as any);
openapi.get("/api/math/factorial", paymentMiddleware, trackMetrics, MathFactorial as any);

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
openapi.post("/api/text/word-count", paymentMiddleware, trackMetrics, TextWordCount as any);
openapi.post("/api/text/reverse", paymentMiddleware, trackMetrics, TextReverse as any);
openapi.post("/api/text/truncate", paymentMiddleware, trackMetrics, TextTruncate as any);
openapi.post("/api/text/regex-test", paymentMiddleware, trackMetrics, TextRegexTest as any);
openapi.post("/api/text/rot13", paymentMiddleware, trackMetrics, TextRot13 as any);
openapi.get("/api/text/lorem-ipsum", paymentMiddleware, trackMetrics, TextLoremIpsum as any);
openapi.get("/api/text/validate-url", paymentMiddleware, trackMetrics, TextValidateUrl as any);
openapi.post("/api/text/diff", paymentMiddleware, trackMetrics, TextDiff as any);
openapi.post("/api/text/unicode-info", paymentMiddleware, trackMetrics, TextUnicodeInfo as any);

// Data endpoints (paid)
openapi.post("/api/data/csv-to-json", paymentMiddleware, trackMetrics, DataCsvToJson as any);
openapi.post("/api/data/json-to-csv", paymentMiddleware, trackMetrics, DataJsonToCsv as any);
openapi.post("/api/data/json-format", paymentMiddleware, trackMetrics, DataJsonFormat as any);
openapi.post("/api/data/json-minify", paymentMiddleware, trackMetrics, DataJsonMinify as any);
openapi.post("/api/data/json-validate", paymentMiddleware, trackMetrics, DataJsonValidate as any);
openapi.post("/api/data/json-path", paymentMiddleware, trackMetrics, DataJsonPath as any);
openapi.post("/api/data/json-flatten", paymentMiddleware, trackMetrics, DataJsonFlatten as any);
openapi.post("/api/data/json-merge", paymentMiddleware, trackMetrics, DataJsonMerge as any);

// Crypto endpoints (paid)
openapi.post("/api/crypto/ripemd160", paymentMiddleware, trackMetrics, CryptoRipemd160 as any);
openapi.get("/api/crypto/random-bytes", paymentMiddleware, trackMetrics, CryptoRandomBytes as any);

// Utility endpoints (paid)
openapi.get("/api/util/timestamp", paymentMiddleware, trackMetrics, UtilTimestamp as any);
openapi.get("/api/util/dns-lookup", paymentMiddleware, trackMetrics, UtilDnsLookup as any);
openapi.get("/api/util/ip-info", paymentMiddleware, trackMetrics, UtilIpInfo as any);
openapi.post("/api/util/qr-generate", paymentMiddleware, trackMetrics, UtilQrGenerate as any);
openapi.get("/api/util/timestamp-convert", paymentMiddleware, trackMetrics, UtilTimestampConvert as any);
openapi.get("/api/util/date-diff", paymentMiddleware, trackMetrics, UtilDateDiff as any);
openapi.post("/api/util/date-add", paymentMiddleware, trackMetrics, UtilDateAdd as any);
openapi.get("/api/util/cron-parse", paymentMiddleware, trackMetrics, UtilCronParse as any);
openapi.get("/api/util/user-agent-parse", paymentMiddleware, trackMetrics, UtilUserAgentParse as any);
openapi.get("/api/util/url-parse", paymentMiddleware, trackMetrics, UtilUrlParse as any);
openapi.get("/api/util/color-convert", paymentMiddleware, trackMetrics, UtilColorConvert as any);
openapi.post("/api/util/markdown-to-html", paymentMiddleware, trackMetrics, UtilMarkdownToHtml as any);
openapi.get("/api/util/http-status", paymentMiddleware, trackMetrics, UtilHttpStatus as any);
openapi.get("/api/util/validate-email", paymentMiddleware, trackMetrics, UtilValidateEmail as any);
openapi.post("/api/util/url-build", paymentMiddleware, trackMetrics, UtilUrlBuild as any);
openapi.post("/api/util/html-to-text", paymentMiddleware, trackMetrics, UtilHtmlToText as any);
openapi.get("/api/util/base64-image", paymentMiddleware, trackMetrics, UtilBase64Image as any);
openapi.get("/api/util/bytes-format", paymentMiddleware, trackMetrics, UtilBytesFormat as any);
openapi.post("/api/util/slugify", paymentMiddleware, trackMetrics, UtilSlugify as any);
openapi.get("/api/util/mime-type", paymentMiddleware, trackMetrics, UtilMimeType as any);
openapi.post("/api/util/regex-escape", paymentMiddleware, trackMetrics, UtilRegexEscape as any);
openapi.post("/api/util/string-distance", paymentMiddleware, trackMetrics, UtilStringDistance as any);
openapi.post("/api/util/verify-signature", paymentMiddleware, trackMetrics, UtilVerifySignature as any);

// Network endpoints (paid)
openapi.get("/api/net/geo-ip", paymentMiddleware, trackMetrics, NetGeoIp as any);
openapi.get("/api/net/asn-lookup", paymentMiddleware, trackMetrics, NetAsnLookup as any);
openapi.get("/api/net/request-fingerprint", paymentMiddleware, trackMetrics, NetRequestFingerprint as any);
openapi.post("/api/net/http-probe", paymentMiddleware, trackMetrics, NetHttpProbe as any);
openapi.post("/api/net/cors-proxy", paymentMiddleware, trackMetrics, NetCorsProxy as any);
openapi.post("/api/net/ssl-check", paymentMiddleware, trackMetrics, NetSslCheck as any);

// Registry endpoints
openapi.post("/api/registry/probe", paymentMiddleware, trackMetrics, RegistryProbe as any);
openapi.post("/api/registry/register", paymentMiddleware, trackMetrics, RegistryRegister as any);
openapi.get("/api/registry/list", RegistryList as any); // Free endpoint
openapi.post("/api/registry/details", paymentMiddleware, trackMetrics, RegistryDetails as any);
openapi.post("/api/registry/update", paymentMiddleware, trackMetrics, RegistryUpdate as any);
openapi.post("/api/registry/delete", paymentMiddleware, trackMetrics, RegistryDelete as any);
openapi.post("/api/registry/my-endpoints", paymentMiddleware, trackMetrics, RegistryMyEndpoints as any);
openapi.post("/api/registry/transfer", paymentMiddleware, trackMetrics, RegistryTransfer as any);
openapi.post("/api/admin/registry/verify", paymentMiddleware, trackMetrics, RegistryAdminVerify as any);
openapi.post("/api/admin/registry/pending", paymentMiddleware, trackMetrics, RegistryAdminPending as any);

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

// Export the Hono app
export default app;
