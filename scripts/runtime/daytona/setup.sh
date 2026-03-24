#!/usr/bin/env bash
# xerus-pod setup — same script for dev (localhost) and prod (Hetzner VPS)
#
# Usage:
#   Dev:   ./scripts/setup.sh
#   Prod:  ./scripts/setup.sh --prod
#
# What it does:
#   1. Installs Docker + docker-compose (if missing)
#   2. Copies correct .env for environment
#   3. Pulls Daytona images
#   4. Starts the Daytona stack
#   5. Waits for API to be healthy
#   6. Registers xerus-sandbox snapshot

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_MODE="${1:-dev}"

log() { echo "[xerus-pod] $*"; }
err() { echo "[xerus-pod] ERROR: $*" >&2; exit 1; }

# ── Step 1: Install Docker if missing ────────────────────────────────────────
install_docker() {
    if command -v docker &>/dev/null; then
        log "Docker already installed: $(docker --version)"
        return 0
    fi

    log "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log "Docker installed: $(docker --version)"
}

# ── Step 2: Ensure docker compose plugin ─────────────────────────────────────
check_compose() {
    if docker compose version &>/dev/null; then
        log "Docker Compose: $(docker compose version --short)"
        return 0
    fi
    err "Docker Compose plugin not found. Install Docker Desktop or the compose plugin."
}

# ── Step 3: Set up .env ──────────────────────────────────────────────────────
setup_env() {
    local env_file="$ROOT_DIR/.env"

    if [[ -f "$env_file" ]]; then
        log "Using existing .env"
        return 0
    fi

    if [[ "$ENV_MODE" == "--prod" ]]; then
        if [[ -f "$ROOT_DIR/config/prod.env" ]]; then
            cp "$ROOT_DIR/config/prod.env" "$env_file"
            log "Copied config/prod.env -> .env"
        else
            err "config/prod.env not found. Copy config/prod.env.example and fill in secrets."
        fi
        # Validate no default credentials in prod
        local weak_defaults=("password" "super_secret_key" "secret_api_token" "ssh_secret_api_token" "CHANGE_ME")
        for weak in "${weak_defaults[@]}"; do
            if grep -q "=${weak}$" "$env_file" 2>/dev/null; then
                err "Weak default credential found in prod .env (contains '${weak}'). Change all passwords before deploying."
            fi
        done
        log "Prod credentials validated (no weak defaults)"
    else
        cp "$ROOT_DIR/config/dev.env.example" "$env_file"
        log "Copied config/dev.env.example -> .env (dev defaults)"
    fi
}

# ── Step 4: Pull and start Daytona stack ─────────────────────────────────────
start_stack() {
    cd "$ROOT_DIR"
    local compose_file="$ROOT_DIR/config/runtime/daytona/docker-compose.yaml"
    if [[ ! -f "$compose_file" ]]; then
        err "docker-compose.yaml not found at $compose_file"
    fi

    log "Pulling Daytona images..."
    docker compose -f "$compose_file" --env-file "$ROOT_DIR/.env" pull

    log "Starting Daytona stack..."
    docker compose -f "$compose_file" --env-file "$ROOT_DIR/.env" up -d

    log "Stack started. Containers:"
    docker compose -f "$compose_file" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

# ── Step 5: Wait for API health ──────────────────────────────────────────────
wait_for_api() {
    local api_port
    api_port=$(grep -E '^DAYTONA_API_PORT=' "$ROOT_DIR/.env" 2>/dev/null | cut -d= -f2)
    api_port="${api_port:-3000}"
    local url="http://localhost:${api_port}/health"

    log "Waiting for Daytona API at $url..."
    local retries=0
    local max_retries=60

    while [[ $retries -lt $max_retries ]]; do
        if curl -sf "$url" &>/dev/null; then
            log "Daytona API is healthy"
            return 0
        fi
        retries=$((retries + 1))
        sleep 2
    done

    err "Daytona API did not become healthy after $((max_retries * 2))s"
}

# ── Step 6: Register xerus-sandbox snapshot ──────────────────────────────────
register_snapshot() {
    log "Registering xerus-sandbox snapshot..."
    bash "$SCRIPT_DIR/register-snapshot.sh"
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
    log "Setting up xerus-pod ($ENV_MODE)..."

    install_docker
    check_compose
    setup_env
    start_stack
    wait_for_api
    register_snapshot

    local api_port
    api_port=$(grep -E '^DAYTONA_API_PORT=' "$ROOT_DIR/.env" 2>/dev/null | cut -d= -f2)
    api_port="${api_port:-3000}"

    log ""
    log "Setup complete!"
    log ""
    log "  Daytona API:       http://localhost:${api_port}/api"
    log "  Daytona Dashboard: http://localhost:${api_port}/dashboard"
    log "  Proxy:             http://proxy.localhost:4000"
    log "  Preview URL format: http://{port}-{sandboxId}.proxy.localhost:4000"
    log ""
    log "xerus_backend .env (already configured):"
    log "  DAYTONA_API_URL=http://localhost:${api_port}/api"
    log "  DAYTONA_API_KEY=<same key as in this .env>"
}

main "$@"
