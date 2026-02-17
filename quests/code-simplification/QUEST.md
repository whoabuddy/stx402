# Quest: code-simplification

## Goal

Reduce bundle size, remove dead code, and improve maintainability of the STX402 codebase.

Two independent code reviews identified concrete opportunities: dead source files, misplaced dependencies, stale patches, unused exports, duplicated CSS/JS in HTML pages, and repeated boilerplate across agent endpoints. This quest addresses all findings in a phased, safe rollout.

## Repositories

| Repo | Path | Role |
|------|------|------|
| stx402 | `/home/whoabuddy/dev/whoabuddy/stx402` | Primary (Cloudflare Workers) |

## Expected Outcomes

- Bundle size reduced from ~1.9MB to ~1.0MB (minify flag alone)
- 4 dead source files removed from production tree
- `@stacks/wallet-sdk` moved out of production dependencies (test-only)
- Stale patch and `patch-package` infrastructure removed
- Unused exports cleaned from 3 utility modules
- ~70KB of duplicated inline CSS/JS extracted to shared helper
- ~100 lines of boilerplate removed from agent endpoints via shared helper

## Status

pending
