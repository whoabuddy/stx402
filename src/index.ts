import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Health } from "./endpoints/health";
import { GetBnsName } from "./endpoints/getBnsName";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/health", Health);
openapi.get("/api/get-bns-name/{address}", GetBnsName);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app;
