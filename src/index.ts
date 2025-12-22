import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Health } from "./endpoints/health";
import { handler as getBnsNameHandler } from "./endpoints/getBnsName";
import { handler as validateStacksAddressHandler } from "./endpoints/validateStacksAddress";
import { x402PaymentMiddleware } from "./middleware/x402-stacks";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/health", Health);

const paymentMiddleware = x402PaymentMiddleware();

openapi.get("/api/get-bns-name/:address", paymentMiddleware, getBnsNameHandler);
openapi.get(
  "/api/validate-stacks-address/:address",
  paymentMiddleware,
  validateStacksAddressHandler
);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app;
