# Phases: code-simplification

## Phase 1: Remove dead code and shrink bundle

**Goal:** Eliminate dead files, fix dependency placement, remove stale patch, and enable minification.

**Status:** pending

**Items addressed:**
1. Move `@stacks/wallet-sdk` to devDependencies; relocate `src/utils/wallet.ts` to `tests/`
2. Delete dead source files: `src/utils/bns.ts`, `src/utils/network.ts`, `src/utils/response.ts`
3. Add `minify: true` to `wrangler.jsonc`
4. Remove stale `patches/x402-stacks+1.1.1.patch`, `patch-package` from devDependencies, and the `postinstall` script

**Verification:** `npm run dev` starts without errors; no runtime references to deleted files.

**Dependencies:** None

---

## Phase 2: Clean unused exports

**Goal:** Remove unused exported functions/constants from utility modules to reduce surface area and prevent false-positive IDE references.

**Status:** pending

**Items addressed:**
5. In `src/utils/erc8004.ts`: un-export `SIP018_PREFIX` (make local const -- only used internally). Note: `boolCV`, `computeDomainHash`, and `REPUTATION_DOMAIN` are actively imported by agent endpoints and must NOT be removed.
6. In `src/utils/signatures.ts`: remove `verifySimpleSignature` (never called anywhere).
7. In `src/utils/hiro.ts`: remove `isHiroRateLimitError` (never imported by production code).
8. In `src/utils/erc8004.ts`: remove one-line wrapper functions (`uint`, `principal`, `buffer`, `stringUtf8`, `none`, `some`, `list`, `boolCV`) that just re-export `@stacks/transactions` CVs. Update all 14 agent endpoint files to import `uintCV`, `principalCV`, etc. directly from `@stacks/transactions`.

**Verification:** `npm run dev` starts without errors; `grep` confirms no remaining imports of removed symbols.

**Dependencies:** Phase 1 (dead files removed first to avoid confusion during grep audits)

---

## Phase 3: Extract shared CSS from inline HTML pages

**Goal:** Deduplicate the ~70KB of inline CSS/JS embedded across `dashboard.ts`, `toolbox.ts`, and `guide.ts`. Deduplicate the SVG logo between `favicon.ts` and `nav.ts`.

**Status:** pending

**Items addressed:**
9a. Create a shared CSS/page-shell helper in `src/components/` that provides base styles (reset, typography, dark theme, responsive breakpoints) and page shell (head, nav, footer).
9b. Refactor `dashboard.ts`, `toolbox.ts`, and `guide.ts` to use the shared helper, keeping only page-specific styles and content inline.
9c. Extract the SVG logo path data to a shared constant; reference from both `favicon.ts` and `nav.ts`.

**Verification:** `npm run dev` starts; visual spot-check of `/dashboard`, `/guide`, `/toolbox` pages; `/favicon.svg` still renders.

**Dependencies:** Phase 1 (clean baseline)

---

## Phase 4: Create shared agent endpoint helper

**Goal:** Extract the repeated `callRegistryFunction` -> `clarityToJson` -> `isSome`/`isNone`/`extractValue` pattern into a shared helper, reducing boilerplate across 14 agent endpoint files.

**Status:** pending

**Items addressed:**
10a. Create a `callAndExtract` helper (or similar) in `src/utils/erc8004.ts` that wraps the common call-parse-check pattern with typed return.
10b. Refactor agent endpoint files to use the new helper, targeting files that repeat the full pattern (agentInfo, agentOwner, agentUri, agentVersion, agentMetadata, agentLookup, reputationClients, reputationFeedback, reputationList, reputationSummary, validationList, validationRequests, validationStatus, validationSummary).

**Verification:** `npm run dev` starts without errors; agent endpoint behavior unchanged (same JSON shape in responses).

**Dependencies:** Phase 2 (wrapper functions already cleaned up; imports stabilized)
