<?xml version="1.0" encoding="UTF-8"?>
<plan>
  <goal>Add patch-package infrastructure to stx402 and apply a 120s timeout patch to x402-stacks 2.0.1 verifier files so sBTC settlements don't time out on SIP-010 contract calls.</goal>
  <context>
    The x402-stacks npm package (v2.0.1) ships with two verifier files that use short HTTP timeouts:
    - dist/verifier-v2.js: 30000ms (30s) for the V2 verifier constructor
    - dist/verifier.js: 15000ms (15s) for the V1/legacy verifier constructor

    sBTC settlements involve SIP-010 contract calls that can take longer than these defaults,
    causing payment verification to fail. The fix is to bump both to 120000ms (2 minutes).

    The upstream x402-api repo already has this patch at patches/x402-stacks+2.0.1.patch.
    stx402 currently has no patches/ directory, no patch-package devDependency, and no
    postinstall script.

    Note: node_modules/x402-stacks/dist/verifier.js in stx402 has already been manually
    modified to 120000. Running npm install will reset it to 15000, after which the
    postinstall patch-package will re-apply the correct values.
  </context>

  <task id="1">
    <name>Add patch-package devDependency and postinstall script</name>
    <files>package.json</files>
    <action>
      Add "patch-package": "^8.0.1" to devDependencies.
      Add "postinstall": "patch-package" to scripts.
      Do NOT run npm install yet — the patch file must exist before postinstall runs.
    </action>
    <verify>
      cat package.json | grep -E '"patch-package"|"postinstall"'
      Expected: both lines present with correct values.
    </verify>
    <done>package.json has patch-package in devDependencies and postinstall script set to "patch-package"</done>
  </task>

  <task id="2">
    <name>Create patches/x402-stacks+2.0.1.patch</name>
    <files>patches/x402-stacks+2.0.1.patch (new file)</files>
    <action>
      Create the patches/ directory and write the patch file that bumps:
      - verifier-v2.js timeout: 30000 -> 120000 (with comment "2 minutes for sBTC contract calls")
      - verifier.js timeout: 15000 -> 120000 (with comment "2 minutes for sBTC contract calls")

      Use the exact patch format from the upstream x402-api repo at:
      /home/whoabuddy/dev/aibtcdev/x402-api/patches/x402-stacks+2.0.1.patch

      The patch uses standard unified diff format with git-style headers.
      The index hashes must match the actual content being patched (from the npm package).
    </action>
    <verify>
      ls patches/x402-stacks+2.0.1.patch
      cat patches/x402-stacks+2.0.1.patch | grep "120000"
      Expected: file exists and contains 120000 for both verifier entries.
    </verify>
    <done>patches/x402-stacks+2.0.1.patch exists with correct diff for both verifier files targeting 120s timeouts</done>
  </task>

  <task id="3">
    <name>Run npm install to apply patch via postinstall</name>
    <files>package-lock.json, node_modules/x402-stacks/dist/verifier.js, node_modules/x402-stacks/dist/verifier-v2.js</files>
    <action>
      Run npm install from the stx402 directory. This will:
      1. Install patch-package as a devDependency
      2. Trigger the postinstall script which runs patch-package
      3. patch-package applies patches/x402-stacks+2.0.1.patch to node_modules

      The node_modules/x402-stacks files will be reset to original values during
      npm install, then the postinstall patch will override them to 120000.
    </action>
    <verify>
      grep "timeout" node_modules/x402-stacks/dist/verifier-v2.js
      grep "timeout" node_modules/x402-stacks/dist/verifier.js
      Expected: both show "timeout: 120000, // 2 minutes for sBTC contract calls"
    </verify>
    <done>npm install completes successfully, both verifier files in node_modules show 120000ms timeout</done>
  </task>
</plan>
