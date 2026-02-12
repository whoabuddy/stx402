---
title: patches
layout: default
nav_order: 5
---

[← Home](index.md) | **patches**

# patches

> Package patches applied via patch-package.

## How Patches Work

Patches are applied automatically on `npm install` via the `postinstall` script:

```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

## Current Patches

| Patch File | Status | Notes |
|-----------|--------|-------|
| `x402-stacks+1.1.1.patch` | Stale | Created for v1.1.1; current dep is `^2.0.1`. Only applies if v1.1.1 is installed. |

## Creating New Patches

```bash
# Edit file in node_modules
vim node_modules/package-name/file.js

# Create patch
npx patch-package package-name
```

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/patches)*
