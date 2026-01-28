#!/bin/bash
# Cron script to run randomized test samples - ensures full coverage over time
# Usage: ./scripts/run-tests-cron.sh
#
# Recommended cron schedule (every 3 hours for mainnet):
#   0 */3 * * * /home/whoabuddy/dev/whoabuddy/stx402/scripts/run-tests-cron.sh  # 8x/day
#
# Coverage calculation:
#   - 16 stateless endpoints, 4 lifecycle categories (info, registry, links, agent)
#   - Each run: 3 stateless + 2 lifecycle = good variance
#   - 8x/day: 24 stateless + 16 lifecycle = ~1.5x coverage

# Set up PATH for cron environment (bun, node, npm, etc.)
export PATH="$HOME/.bun/bin:$HOME/.nvm/versions/node/$(ls -1 $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Change to project directory
cd "$(dirname "$0")/.."

# Load environment variables from .env if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Also try .dev.vars (wrangler format)
if [ -f .dev.vars ]; then
  set -a
  source .dev.vars
  set +a
fi

# Force production settings
export X402_NETWORK=mainnet
export X402_WORKER_URL=https://stx402.com

# Configuration
LOG_DIR="logs/test-runs"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="${LOG_DIR}/test-${TIMESTAMP}.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Run tests and capture output to temp file
TEMP_LOG=$(mktemp)
echo "=== Test Run Started: $(date) ===" > "$TEMP_LOG"
echo "Network: ${X402_NETWORK}" >> "$TEMP_LOG"
echo "Server: ${X402_WORKER_URL}" >> "$TEMP_LOG"
echo "" >> "$TEMP_LOG"

# Run the randomized test suite
# - Sample 3 stateless endpoints + 2 random lifecycle categories
# - stx402 is mainnet only, uses STX (not random token to reduce costs)
bun run tests/_run_all_tests.ts --mode=full --sample=3 --random-lifecycle=2 >> "$TEMP_LOG" 2>&1
EXIT_CODE=$?

echo "" >> "$TEMP_LOG"
echo "=== Test Run Completed: $(date) ===" >> "$TEMP_LOG"
echo "Exit Code: $EXIT_CODE" >> "$TEMP_LOG"

# Only keep log if tests failed
if [ $EXIT_CODE -ne 0 ]; then
  mv "$TEMP_LOG" "$LOG_FILE"
  # Keep only last 7 days of failure logs
  find "$LOG_DIR" -name "test-*.log" -mtime +7 -delete 2>/dev/null || true
else
  rm -f "$TEMP_LOG"
fi

exit $EXIT_CODE
