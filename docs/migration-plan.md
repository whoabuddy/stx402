# STX402 Migration Plan

**Goal**: Transform stx402.com from a general-purpose API into a focused "meta layer" for the x402 ecosystem.

## Guiding Principles

1. **stx402.com = Meta Layer** - Discovery, registry, agent identity
2. **x402.aibtc.com = Workhorse** - Actual useful endpoints people call
3. **No duplicates** - If it exists on aibtc, remove it from stx402
4. **Lean is better** - Fewer, more focused endpoints

---

## Phase 1: Remove Duplicates (Already on aibtc)

These endpoints exist on x402.aibtc.com and should be **deleted** from stx402:

### Stacks (4 endpoints to remove)
```
DELETE: /api/stacks/convert-address/:address  → aibtc: /stacks/address/:address
DELETE: /api/stacks/decode-clarity-hex        → aibtc: /stacks/decode/clarity
DELETE: /api/stacks/decode-tx                 → aibtc: /stacks/decode/transaction
DELETE: /api/stacks/profile/:address          → aibtc: /stacks/profile/:address
```

### Hashing (5 endpoints to remove)
```
DELETE: /api/hash/sha256     → aibtc: /hashing/sha256
DELETE: /api/hash/sha512     → aibtc: /hashing/sha512
DELETE: /api/hash/keccak256  → aibtc: /hashing/keccak256
DELETE: /api/hash/hash160    → aibtc: /hashing/hash160
DELETE: /api/hash/ripemd160  → aibtc: /hashing/ripemd160
```

### Storage - KV (4 endpoints to remove)
```
DELETE: /api/kv/set     → aibtc: /storage/kv (POST)
DELETE: /api/kv/get     → aibtc: /storage/kv/:key (GET)
DELETE: /api/kv/delete  → aibtc: /storage/kv/:key (DELETE)
DELETE: /api/kv/list    → aibtc: /storage/kv (GET)
```

### Storage - Paste (3 endpoints to remove)
```
DELETE: /api/paste/create  → aibtc: /storage/paste (POST)
DELETE: /api/paste/:code   → aibtc: /storage/paste/:id (GET)
DELETE: /api/paste/delete  → aibtc: /storage/paste/:id (DELETE)
```

### Storage - SQL (3 endpoints to remove)
```
DELETE: /api/sql/query    → aibtc: /storage/db/query
DELETE: /api/sql/execute  → aibtc: /storage/db/execute
DELETE: /api/sql/schema   → aibtc: /storage/db/schema
```

### Storage - Sync (5 endpoints to remove)
```
DELETE: /api/sync/lock    → aibtc: /storage/sync/lock
DELETE: /api/sync/unlock  → aibtc: /storage/sync/unlock
DELETE: /api/sync/check   → aibtc: /storage/sync/status/:name
DELETE: /api/sync/extend  → aibtc: /storage/sync/extend
DELETE: /api/sync/list    → aibtc: /storage/sync/list
```

### Storage - Queue (5 endpoints to remove)
```
DELETE: /api/queue/push     → aibtc: /storage/queue/push
DELETE: /api/queue/pop      → aibtc: /storage/queue/pop
DELETE: /api/queue/complete → (no equivalent - consider adding to aibtc)
DELETE: /api/queue/fail     → (no equivalent - consider adding to aibtc)
DELETE: /api/queue/status   → aibtc: /storage/queue/status
```

### Storage - Memory (5 endpoints to remove)
```
DELETE: /api/memory/store   → aibtc: /storage/memory/store
DELETE: /api/memory/recall  → (no equivalent - consider adding to aibtc)
DELETE: /api/memory/search  → aibtc: /storage/memory/search
DELETE: /api/memory/list    → aibtc: /storage/memory/list
DELETE: /api/memory/forget  → aibtc: /storage/memory/delete
```

**Phase 1 Total: 34 endpoints removed**

---

## Phase 2: Evaluate "Useful" Endpoints

These endpoints are unique to stx402. Decision: migrate to aibtc or delete entirely?

### AI Endpoints (13 endpoints)

These use Cloudflare Workers AI. Since aibtc already has `/inference/cloudflare/chat`, these are essentially convenience wrappers.

| Endpoint | Decision | Rationale |
|----------|----------|-----------|
| `/api/ai/dad-joke` | DELETE | Demo/novelty, not useful |
| `/api/ai/summarize` | MIGRATE | Actually useful |
| `/api/ai/image-describe` | MIGRATE | Actually useful |
| `/api/ai/tts` | MIGRATE | Actually useful |
| `/api/ai/generate-image` | MIGRATE | Actually useful |
| `/api/ai/explain-contract` | MIGRATE | Stacks-specific, valuable |
| `/api/ai/translate` | DELETE | Use generic chat instead |
| `/api/ai/sentiment` | DELETE | Use generic chat instead |
| `/api/ai/keywords` | DELETE | Use generic chat instead |
| `/api/ai/language-detect` | DELETE | Use generic chat instead |
| `/api/ai/paraphrase` | DELETE | Use generic chat instead |
| `/api/ai/grammar-check` | DELETE | Use generic chat instead |
| `/api/ai/question-answer` | DELETE | Use generic chat instead |

**Migrate to aibtc**: summarize, image-describe, tts, generate-image, explain-contract (5)
**Delete**: dad-joke, translate, sentiment, keywords, language-detect, paraphrase, grammar-check, question-answer (8)

### Stacks Unique Endpoints (3 endpoints)

| Endpoint | Decision | Rationale |
|----------|----------|-----------|
| `/api/stacks/to-consensus-buff` | MIGRATE | Clarity dev tool, useful |
| `/api/stacks/from-consensus-buff` | MIGRATE | Clarity dev tool, useful |
| `/api/stacks/contract-info/:id` | MIGRATE | Aggregated data, useful |

**Migrate to aibtc**: All 3

### Utility Endpoints (4 endpoints)

| Endpoint | Decision | Rationale |
|----------|----------|-----------|
| `/api/util/qr-generate` | MIGRATE | Actually useful |
| `/api/util/verify-signature` | DELETE | aibtc has verify-message + verify-sip018 |
| `/api/data/json-minify` | DELETE | Trivial, free, not worth hosting |
| `/api/data/json-validate` | DELETE | Trivial, free, not worth hosting |

**Migrate to aibtc**: qr-generate (1)
**Delete**: verify-signature, json-minify, json-validate (3)

### Hash Unique (1 endpoint)

| Endpoint | Decision | Rationale |
|----------|----------|-----------|
| `/api/hash/hmac` | MIGRATE | Useful for Clarity compat |

**Migrate to aibtc**: hmac (1)

### Stateful Unique Endpoints

| Category | Endpoints | Decision | Rationale |
|----------|-----------|----------|-----------|
| **Links** | 5 | KEEP | URL shortener fits "meta" theme |
| **Counters** | 6 | DELETE | Not meta, not useful enough |

---

## Phase 3: What Stays on stx402.com

### Core Meta Layer

| Category | Count | Purpose |
|----------|-------|---------|
| **Registry** | 10 | X402 endpoint directory |
| **Agent (ERC-8004)** | 16 | Agent identity on Stacks |
| **Links** | 5 | URL shortener (meta utility) |
| **Health/Info** | 5 | Dashboard, about, guide, toolbox |

### Final Endpoint Count

```
Before:  ~97 endpoints
After:   ~36 endpoints

Breakdown:
- Registry:     10 endpoints
- Agent:        16 endpoints
- Links:         5 endpoints
- Health/Info:   5 endpoints
                ─────────────
Total:          36 endpoints
```

---

## Phase 4: Migration to aibtc (Backlog)

Create issues in x402-api repo to add these from stx402:

### Priority 1: Clarity Tools
- [ ] `POST /stacks/consensus/encode` (from to-consensus-buff)
- [ ] `POST /stacks/consensus/decode` (from from-consensus-buff)
- [ ] `GET /stacks/contract/:id/info` (aggregated contract data)

### Priority 2: AI Convenience
- [ ] `POST /inference/cloudflare/summarize`
- [ ] `POST /inference/cloudflare/describe-image`
- [ ] `POST /inference/cloudflare/tts`
- [ ] `POST /inference/cloudflare/generate-image`
- [ ] `GET /stacks/contract/:id/explain` (AI explanation)

### Priority 3: Utilities
- [ ] `POST /util/qr` (QR code generation)
- [ ] `POST /hashing/hmac`

### Priority 4: Queue Extensions
- [ ] `POST /storage/queue/complete` (mark job done)
- [ ] `POST /storage/queue/fail` (mark job failed with retry)

---

## Implementation Checklist

### Step 1: Prepare
- [ ] Create this migration plan document
- [ ] Review with stakeholders
- [ ] Create backup of current stx402 state

### Step 2: Remove Duplicates (Phase 1)
- [ ] Delete duplicate endpoint files from `src/endpoints/`
- [ ] Remove imports from `src/index.ts`
- [ ] Remove from `ENDPOINT_TIERS` in `src/utils/pricing.ts`
- [ ] Update `tests/endpoint-registry.ts`
- [ ] Run `npm run sync-counts`
- [ ] Test remaining endpoints

### Step 3: Remove Non-Meta Endpoints (Phase 2)
- [ ] Delete AI endpoints (8 deletions)
- [ ] Delete utility endpoints (3 deletions)
- [ ] Delete counter endpoints (6 deletions)
- [ ] Delete Stacks endpoints being migrated (3 deletions)
- [ ] Update all related files

### Step 4: Clean Up
- [ ] Remove unused utilities and helpers
- [ ] Remove unused Durable Object methods (counters)
- [ ] Update CLAUDE.md with new endpoint counts
- [ ] Update README.md
- [ ] Update dashboard/about pages

### Step 5: Create aibtc Migration Issues
- [ ] File issues for Priority 1-4 items in x402-api repo

### Step 6: Deploy
- [ ] Test locally with `npm run dev`
- [ ] Verify all tests pass
- [ ] Commit and push (auto-deploys)
- [ ] Verify production

---

## Files to Modify

### Delete Endpoints (src/endpoints/)
```
# Phase 1 - Duplicates
convertAddressToNetwork.ts
decodeClarityHex.ts
stacksDecodeTx.ts
stacksProfile.ts
hash/sha256.ts, sha512.ts, keccak256.ts, hash160.ts, ripemd160.ts
kv/*.ts (4 files)
paste/*.ts (3 files)
sql/*.ts (3 files)
sync/*.ts (5 files)
queue/*.ts (5 files)
memory/*.ts (5 files)

# Phase 2 - Non-meta
dadJoke.ts
aiTranslate.ts, aiSentiment.ts, aiKeywords.ts, aiLanguageDetect.ts
aiParaphrase.ts, aiGrammarCheck.ts, aiQuestionAnswer.ts
summarize.ts, imageDescribe.ts, tts.ts, generateImage.ts, aiExplainContract.ts
stacksToConsensusBuff.ts, stacksFromConsensusBuff.ts, stacksContractInfo.ts
utilQrGenerate.ts, utilVerifySignature.ts
dataJsonMinify.ts, dataJsonValidate.ts
hash/hmac.ts
counter/*.ts (6 files)
```

### Keep Endpoints
```
# Registry (10)
registryProbe.ts
registryRegister.ts
registryList.ts
registryDetails.ts
registryUpdate.ts
registryDelete.ts
registryMyEndpoints.ts
registryTransfer.ts
registryAdminVerify.ts
registryAdminPending.ts

# Agent ERC-8004 (16)
agent/*.ts (all files)

# Links (5)
links/*.ts (all files)

# Health/Info (5)
health.ts
dashboard.ts
about.ts
guide.ts
toolbox.ts
```

---

## Phase 2: Documentation & Polish

### Switch from Scalar to Swagger UI

Currently using Scalar for API docs, but this creates issues:
- SPA makes it hard to directly access `/openapi.json`
- Harder to browse and test endpoints
- aibtc uses default Swagger UI which is simpler and more functional

**TODO**: Replace `getScalarHTML()` with chanfana's built-in Swagger UI:
```typescript
// Current (Scalar SPA)
app.get("/docs", (c) => c.html(getScalarHTML("/openapi.json")));

// Target (Swagger UI like aibtc)
const openapi = fromHono(app, {
  docs_url: "/docs",  // Enable built-in Swagger UI
  // ...
});
```

Files to modify:
- `src/index.ts` - Remove custom `/docs` route, enable `docs_url`
- `src/endpoints/scalarDocs.ts` - Delete (no longer needed)

---

## Post-Migration: stx402.com Identity

**Tagline**: "The X402 Directory"

**Purpose**:
1. Discover x402-compatible endpoints across the ecosystem
2. Register your own endpoints for discovery
3. Look up ERC-8004 agent identities on Stacks
4. Track agent reputation and validation

**Not Purpose**:
- General-purpose utilities (use x402.aibtc.com)
- AI inference (use x402.aibtc.com)
- Storage primitives (use x402.aibtc.com)
