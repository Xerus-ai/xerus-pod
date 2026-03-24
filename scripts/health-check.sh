#!/usr/bin/env bash
# Generic health check — delegates to the TypeScript orchestrator
#
# Usage:
#   ./scripts/health-check.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [[ -f "$ROOT_DIR/.env" ]]; then
    set -a; source "$ROOT_DIR/.env"; set +a
fi

cd "$ROOT_DIR"
exec npx tsx src/orchestrator.ts health
