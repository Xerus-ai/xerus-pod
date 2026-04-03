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
POD_DOCKERFILES_DIR="$ROOT_DIR/dockerfiles"

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

# Prefer xerus-pod/dockerfiles/ if it exists, fall back to xerus_backend/docker/
if [[ -f "$POD_DOCKERFILES_DIR/Dockerfile.xerus-sandbox" ]]; then
    DOCKERFILE_PATH="$POD_DOCKERFILES_DIR/Dockerfile.xerus-sandbox"
    PACKAGE_JSON_PATH="$POD_DOCKERFILES_DIR/runner-package.json"
elif [[ -f "$BACKEND_DIR/docker/Dockerfile.xerus-snapshot" ]]; then
    DOCKERFILE_PATH="$BACKEND_DIR/docker/Dockerfile.xerus-snapshot"
    PACKAGE_JSON_PATH="$BACKEND_DIR/docker/runner-package.json"
else
    err "Dockerfile not found. Expected at $POD_DOCKERFILES_DIR/Dockerfile.xerus-sandbox or $BACKEND_DIR/docker/Dockerfile.xerus-snapshot"
fi

if [[ ! -f "$PACKAGE_JSON_PATH" ]]; then
    err "runner-package.json not found at $PACKAGE_JSON_PATH"
fi

# Run the create-snapshot script from xerus_backend
log "Building xerus-sandbox snapshot..."
log "  API URL: $DAYTONA_API_URL"
log "  Dockerfile: $DOCKERFILE_PATH"

cd "$BACKEND_DIR"
DAYTONA_API_URL="$DAYTONA_API_URL" DAYTONA_API_KEY="$DAYTONA_API_KEY" \
XERUS_DOCKERFILE_PATH="$DOCKERFILE_PATH" \
    npx tsx scripts/create-snapshot.ts

log "xerus-sandbox snapshot registered successfully"
