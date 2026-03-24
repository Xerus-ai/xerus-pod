#!/usr/bin/env bash
# Generic setup dispatcher — reads POD_RUNTIME_PROVIDER and delegates
#
# Usage:
#   ./scripts/setup.sh           # Uses provider from .env
#   ./scripts/setup.sh --prod    # Production mode (passed to provider script)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if present
if [[ -f "$ROOT_DIR/.env" ]]; then
    set -a; source "$ROOT_DIR/.env"; set +a
fi

RUNTIME="${POD_RUNTIME_PROVIDER:-daytona}"
RUNTIME_SCRIPT="$SCRIPT_DIR/runtime/$RUNTIME/setup.sh"

if [[ ! -f "$RUNTIME_SCRIPT" ]]; then
    echo "ERROR: No setup script for runtime '$RUNTIME' at $RUNTIME_SCRIPT" >&2
    echo "Available runtimes:" >&2
    ls -d "$SCRIPT_DIR/runtime"/*/ 2>/dev/null | xargs -I{} basename {} >&2
    exit 1
fi

echo "[xerus-pod] Runtime: $RUNTIME"
exec bash "$RUNTIME_SCRIPT" "$@"
