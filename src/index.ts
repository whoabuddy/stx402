import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Health } from "./endpoints/health";
import { GetBnsName } from "./endpoints/getBnsName";
import { ValidateStacksAddress } from "./endpoints/validateStacksAddress";
import { ConvertAddressToNetwork } from "./endpoints/convertAddressToNetwork";
import { DecodeClarityHex } from "./endpoints/decodeClarityHex";
import { DeepThought } from "./endpoints/deepThought";
import { CoinToss } from "./endpoints/coinToss";
import { DadJoke } from "./endpoints/dadJoke";
import { ImageDescribe } from "./endpoints/imageDescribe";
import { Tts } from "./endpoints/tts";
import { Summarize } from "./endpoints/summarize";
import { x402PaymentMiddleware } from "./middleware/x402-stacks";

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

// Register OpenAPI endpoints
openapi.get("/api/health", Health);

const paymentMiddleware = x402PaymentMiddleware();

openapi.get("/api/get-bns-name/:address", paymentMiddleware, GetBnsName as any);
openapi.get(
  "/api/validate-stacks-address/:address",
  paymentMiddleware,
  ValidateStacksAddress as any
);
openapi.get(
  "/api/convert-address-to-network/:address",
  paymentMiddleware,
  ConvertAddressToNetwork as any
);
openapi.post(
  "/api/decode-clarity-hex",
  paymentMiddleware,
  DecodeClarityHex as any
);

openapi.get("/api/deep-thought", paymentMiddleware, DeepThought as any);
openapi.get("/api/coin-toss", paymentMiddleware, CoinToss as any);
openapi.get("/api/dad-joke", paymentMiddleware, DadJoke as any);

openapi.post("/api/ai/image-describe", paymentMiddleware, ImageDescribe as any);
openapi.post("/api/ai/tts", paymentMiddleware, Tts as any);
openapi.post("/api/ai/summarize", paymentMiddleware, Summarize as any);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app;
