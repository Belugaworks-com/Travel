#!/bin/bash
# Prepares Claude Code cloud sessions: installs the app's npm dependencies and
# playwright-cli, and points playwright-cli at the container's preinstalled
# Chromium (it defaults to Google Chrome).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ -f package.json ]; then
  npm install --no-audit --no-fund >&2
fi

if ! command -v playwright-cli >/dev/null 2>&1; then
  npm install -g @playwright/cli@latest >&2
fi

# Node's built-in fetch ignores HTTPS_PROXY unless told to; the app's API
# calls (SerpApi, Aviationstack) need it to leave this container.
if [ -n "${HTTPS_PROXY:-}" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export NODE_USE_ENV_PROXY=1' >> "$CLAUDE_ENV_FILE"
fi

if [ -x /opt/pw-browsers/chromium ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PLAYWRIGHT_MCP_BROWSER=chromium' >> "$CLAUDE_ENV_FILE"
  echo 'export PLAYWRIGHT_MCP_EXECUTABLE_PATH=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
fi
