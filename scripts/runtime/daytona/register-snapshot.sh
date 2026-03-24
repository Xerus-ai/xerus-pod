#!/usr/bin/env bash
# Register xerus-sandbox snapshot with the local Daytona instance
#
# Uses the Daytona SDK script from xerus_backend to build and push
# the custom snapshot image (Dockerfile.xerus-snapshot).
#
# Prerequisites:
#   - Daytona stack running (docker compose up)
#   - DAYTONA_API_KEY set in .env (same as ADMIN_API_KEY in docker-compose)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BACKEND_DIR="${XERUS_BACKEND_DIR:-$(realpath "$ROOT_DIR/../xerus/xerus_backend" 2>/dev/null || echo "$ROOT_DIR/../xerus/xerus_backend")}"

log() { echo "[register-snapshot] $*"; }
err() { echo "[register-snapshot] ERROR: $*" >&2; exit 1; }

# Load .env
if [[ -f "$ROOT_DIR/.env" ]]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

# Resolve API URL
API_PORT="${DAYTONA_API_PORT:-3000}"
DAYTONA_API_URL="${DAYTONA_API_URL:-http://localhost:${API_PORT}/api}"

# Check prerequisites
if [[ -z "${DAYTONA_API_KEY:-}" ]]; then
    err "DAYTONA_API_KEY not set in .env. This is the same key as ADMIN_API_KEY in docker-compose."
fi

if [[ ! -f "$BACKEND_DIR/docker/Dockerfile.xerus-snapshot" ]]; then
    err "Dockerfile.xerus-snapshot not found at $BACKEND_DIR/docker/"
fi

if [[ ! -f "$BACKEND_DIR/docker/runner-package.json" ]]; then
    err "runner-package.json not found at $BACKEND_DIR/docker/"
fi

# Run the create-snapshot script from xerus_backend
log "Building xerus-sandbox snapshot..."
log "  API URL: $DAYTONA_API_URL"
log "  Dockerfile: $BACKEND_DIR/docker/Dockerfile.xerus-snapshot"

cd "$BACKEND_DIR"
DAYTONA_API_URL="$DAYTONA_API_URL" DAYTONA_API_KEY="$DAYTONA_API_KEY" \
    npx tsx scripts/create-snapshot.ts

log "xerus-sandbox snapshot registered successfully"
