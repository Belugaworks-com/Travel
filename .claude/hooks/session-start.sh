#!/bin/bash
# Prepares Claude Code cloud sessions: installs playwright-cli and points it at
# the container's preinstalled Chromium (the CLI defaults to Google Chrome).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v playwright-cli >/dev/null 2>&1; then
  npm install -g @playwright/cli@latest >&2
fi

if [ -x /opt/pw-browsers/chromium ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PLAYWRIGHT_MCP_BROWSER=chromium' >> "$CLAUDE_ENV_FILE"
  echo 'export PLAYWRIGHT_MCP_EXECUTABLE_PATH=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
fi
