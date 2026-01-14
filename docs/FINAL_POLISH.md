# Final Polish - STX402 Production Readiness

Comprehensive audit of STX402 Directory for production readiness.

## Priority Legend

- **P0 (Critical)**: Broken functionality or misleading content
- **P1 (High)**: Inconsistencies affecting user experience
- **P2 (Medium)**: Polish and improvements
- **P3 (Low)**: Nice to have / future consideration

---

## Issues Found

### P0: Critical Issues ✅ COMPLETED

#### 1. Dashboard References Non-Existent Endpoints ✅
**File**: `src/endpoints/dashboard.ts` (lines 696-703)

```html
<p style="color: #a1a1aa; font-size: 13px;">Register your x402 endpoint via <code>/api/registry/register</code></p>
...
<p style="color: #a1a1aa; font-size: 13px;">Register agents via <code>/api/agent/register</code> | View agents via <code>/api/agent/list</code></p>
```

**Issue**: Routes no longer have `/api/` prefix. Also, `/agent/register` and `/agent/list` don't exist - ERC-8004 agents are registered on-chain, not via our API.

**Fix**:
- Change `/api/registry/register` → `/registry/register`
- Update Agent Registry section text to reference actual endpoints like `/agent/info`, `/agent/lookup`

#### 2. Dashboard Footer Links to Wrong Docs ✅
**File**: `src/endpoints/dashboard.ts` (line 710)

```html
<a href="/" target="_blank">API Docs</a>
```

**Issue**: Root `/` now returns JSON service info. API docs are at `/docs`.

**Fix**: Change to `<a href="/docs" target="_blank">API Docs</a>`

#### 3. getCategoryFromPath Uses Old /api/ Pattern ✅
**File**: `src/endpoints/dashboard.ts` (lines 9-15)

```typescript
function getCategoryFromPath(path: string): string {
  const match = path.match(/^\/api\/([^/]+)/);
  ...
}
```

**Issue**: Paths no longer have `/api/` prefix (e.g., `/registry/probe`, `/agent/info`).

**Fix**: Update regex to `^\/([^/]+)` to match new path structure.

---

### P1: High Priority ✅ COMPLETED

#### 4. OpenAPI Tag Mismatch ✅
**Files**:
- `src/index.ts` (lines 135-142) - defines tags
- `src/endpoints/agent/*.ts` (16 files) - use different tags

**index.ts defines**:
```typescript
tags: [
  { name: "Agent - Identity", ... },
  { name: "Agent - Reputation", ... },
  { name: "Agent - Validation", ... }
]
```

**All agent endpoints use**:
```typescript
tags: ["Agent Registry"]
```

**Impact**: Swagger UI shows "Agent Registry" as orphaned category not matching OpenAPI spec.

**Options**:
1. Update all 16 agent files to use matching tags (e.g., `["Agent - Identity"]`)
2. Update index.ts tags to match what endpoints use

**Recommendation**: Option 2 - simpler, single file change.

#### 5. Root JSON Uses "workhorse" Jargon ✅
**File**: `src/index.ts` (line 101)

```typescript
related: {
  workhorse: "https://x402.aibtc.com",
  ...
}
```

**Issue**: "workhorse" is internal jargon, not clear to external users.

**Fix**: Rename to `utilities` or `general_api`:
```typescript
related: {
  utilities: "https://x402.aibtc.com",
  ...
}
```

#### 6. CLAUDE.md Endpoint Count Mismatch ✅
**File**: `CLAUDE.md` (line 64)

```markdown
From `tests/endpoint-registry.ts:ENDPOINT_COUNTS` (31 total):
```

**Actual count**: 36 endpoints (5 info + 10 registry + 5 links + 16 agent)

**Fix**: Change "31 total" to "36 total"

---

### P2: Medium Priority ✅ COMPLETED

#### 7. Nav Component Comment Outdated ✅
**File**: `src/components/nav.ts` (lines 1-4)

```typescript
/**
 * Shared navigation bar component for all pages
 * Matches aibtc.com branding: black background, orange accents
 */
```

**Issue**: Now it's STX402 branding, not aibtc.com.

**Fix**: Update comment to reflect STX402 Directory branding.

#### 8. Toolbox Simplification ✅
**File**: `src/endpoints/toolbox.ts`

**Current state**: Two tools
- "402 Checker" - tests if URL requires X402 payment
- "Call an Endpoint" - wallet connection + endpoint calling

**User request**: Simplify to just "402 Checker" with enhanced info.

**Action items**:
- Remove "Call an Endpoint" section
- Enhance 402 Checker response to show:
  - Payment requirements breakdown
  - All accepted tokens with equivalent amounts
  - Code example for making the call
  - Link to x402-stacks client library
  - Non-402 scenarios: show useful info (free endpoint, error, CORS blocked)

#### 9. New Logo Integration
**Files affected**:
- `src/endpoints/favicon.ts` - current SVG favicon
- `src/components/nav.ts` - inline SVG logo
- `public/` directory (if exists) - static assets

**User note**: New logo available for stx402. Need to:
1. Get the new logo file (SVG preferred)
2. Update favicon.ts with new SVG
3. Update nav.ts inline logo
4. Consider adding Open Graph / social preview images

#### 10. Browser Wallet Signing Note May Be Outdated
**File**: `src/endpoints/toolbox.ts` (line 1030)

```html
Browser wallet signing (without broadcast) is not yet supported by @stacks/connect.
```

**Question**: Is this still accurate? @stacks/connect v8 may have added this capability.

**Action**: Verify current @stacks/connect capabilities and update note accordingly.

---

### P3: Low Priority / Future

#### 11. SIP URL Points to Feature Branch
**File**: `src/endpoints/agent/registryInfo.ts` (line 74)

```typescript
sipUrl: "https://github.com/stacks-network/sips/blob/feat/sip-erc-8004-agent-registries/sips/sip-XXX/sip-XXX-erc-8004-agent-registries.md"
```

**Issue**: Points to feature branch which may be merged/deleted.

**Action**: Monitor SIP status and update URL when it gets a number and merges to main.

#### 12. Consider Preview URLs for Non-Production
**File**: `wrangler.jsonc`

Preview environments should show staging URLs, not production URLs in OpenAPI spec.

---

## Testing Checklist

### Manual E2E Tests
- [ ] Visit production https://stx402.com
  - [ ] Root `/` returns JSON service info
  - [ ] `/docs` shows Swagger UI
  - [ ] `/dashboard` loads with metrics
  - [ ] `/guide` shows 5 categories (Registry, Links, Agent Identity/Reputation/Validation) + Ecosystem Links section
  - [ ] `/toolbox` loads and 402 Checker works
  - [ ] All nav links work correctly (Docs, Dashboard, Guide, Toolbox)

- [ ] Test 402 Checker with various URLs
  - [ ] stx402.com/registry/probe (should show 402)
  - [ ] stx402.com/registry/list (should show free/200)
  - [ ] x402.aibtc.com/hash/sha256 (should show 402)
  - [ ] invalid URL (should show error)
  - [ ] Cross-origin URL (should show CORS message)

- [ ] Test paid endpoints via x402-stacks client
  - [ ] `/registry/probe`
  - [ ] `/agent/info`
  - [ ] `/links/create`

### Automated Tests
```bash
# Start dev server
npm run dev

# Run all E2E tests
bun run tests/_run_all_tests.ts

# Validate endpoint registry
bun run tests/_validate_endpoints.ts
```

### Content Verification
- [ ] All page footers link to `/docs` not `/`
- [ ] No references to `/api/` prefix paths
- [ ] No references to removed endpoints (hash, ai, storage, etc.)
- [ ] No references to `/about` (removed - content merged to Guide)
- [ ] OpenAPI spec tags match endpoint tags
- [ ] Pricing in guide/toolbox matches pricing.ts

---

## Questions to Resolve

### Logo
1. Where is the new logo file?
2. What format? (SVG preferred for favicon + nav)
3. Should we update Open Graph images too?

### Toolbox Enhancement
1. For the enhanced 402 Checker, what additional info would be most useful?
   - Payment breakdown (amount, tokens, recipient)?
   - Code snippet to call with x402-stacks?
   - Link to facilitator?

### @stacks/connect
1. Has v8 added support for signing without broadcast?
2. If so, can we enable actual paid calls from toolbox?

---

## Files to Modify (Summary)

| File | Changes |
|------|---------|
| `src/index.ts` | Fix OpenAPI tags, rename "workhorse" |
| `src/endpoints/dashboard.ts` | Fix paths, footer link, getCategoryFromPath, agent section |
| `src/endpoints/toolbox.ts` | Remove "Call Endpoint", enhance 402 Checker |
| `src/components/nav.ts` | Update comment, integrate new logo |
| `src/endpoints/favicon.ts` | Integrate new logo |
| `CLAUDE.md` | Fix endpoint count |
| `src/endpoints/agent/*.ts` | (Optional) Update tags if we don't fix index.ts |

---

## Recommended Order of Operations

1. **P0 Critical** - Fix dashboard broken references
2. **P1 High** - Fix OpenAPI tags, JSON terminology, CLAUDE.md
3. **Logo** - Get new logo, update favicon.ts and nav.ts
4. **Toolbox** - Simplify and enhance 402 Checker
5. **P2 Polish** - Comments, final review
6. **Test** - Full E2E validation
7. **Deploy** - Push to production

---

## Notes

- Total endpoint count: 35 (not 31)
  - Info: 4 (health, dashboard, guide, toolbox)
  - Registry: 10 (probe, register, list, details, update, delete, my-endpoints, transfer, admin-verify, admin-pending)
  - Links: 5 (create, expand, stats, delete, list)
  - Agent: 16 (registry, info, owner, uri, metadata, version, lookup, reputation×5, validation×4)

- Paid endpoints: 27
- Free endpoints: 8 (4 info + registry/list + links/expand + agent/registry + 2 admin)

Last updated: 2025-01-14
