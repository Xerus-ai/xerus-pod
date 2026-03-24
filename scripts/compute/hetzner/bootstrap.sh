#!/usr/bin/env bash
# Provision a Hetzner VPS and bootstrap it with xerus-pod Daytona stack
#
# Prerequisites:
#   - hcloud CLI installed and configured (hcloud context create xerus)
#   - config/prod.env filled with production secrets
#
# Usage:
#   ./scripts/bootstrap-hetzner.sh                    # CX32 in nbg1 (default)
#   ./scripts/bootstrap-hetzner.sh --type cx42        # Larger VPS
#   ./scripts/bootstrap-hetzner.sh --location fsn1    # Different DC
#   ./scripts/bootstrap-hetzner.sh --name xerus-pod-2 # Custom name

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load .env if present
if [[ -f "$ROOT_DIR/.env" ]]; then
    set -a; source "$ROOT_DIR/.env"; set +a
fi

# Defaults (from env or hardcoded)
SERVER_NAME="${HETZNER_SERVER_NAME:-xerus-pod-1}"
SERVER_TYPE="cx32"
LOCATION="nbg1"
IMAGE="ubuntu-24.04"
SSH_KEY_NAME="xerus"

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --name)     SERVER_NAME="$2"; shift 2 ;;
        --type)     SERVER_TYPE="$2"; shift 2 ;;
        --location) LOCATION="$2"; shift 2 ;;
        --image)    IMAGE="$2"; shift 2 ;;
        --ssh-key)  SSH_KEY_NAME="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

log() { echo "[hetzner:bootstrap] $*"; }
err() { echo "[hetzner:bootstrap] ERROR: $*" >&2; exit 1; }

# Verify hcloud
if ! command -v hcloud &>/dev/null; then
    err "hcloud CLI not installed. Install: https://github.com/hetznercloud/cli"
fi

# Verify SSH key exists
if ! hcloud ssh-key describe "$SSH_KEY_NAME" &>/dev/null; then
    log "SSH key '$SSH_KEY_NAME' not found in Hetzner."
    log "Create one with: hcloud ssh-key create --name $SSH_KEY_NAME --public-key-from-file ~/.ssh/id_rsa.pub"
    err "SSH key required"
fi

# Repo URL — must be set in env or passed via --repo
REPO_URL="${XERUS_POD_REPO:-}"
if [[ -z "$REPO_URL" ]]; then
    err "XERUS_POD_REPO env var required (e.g. https://github.com/your-org/xerus-pod.git)"
fi

# Generate cloud-init script (not a heredoc — variable interpolation needed)
CLOUD_INIT="#!/bin/bash
set -euo pipefail
exec > /var/log/xerus-pod-setup.log 2>&1

echo '[cloud-init] Starting xerus-pod bootstrap...'

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install git + Node.js
apt-get update && apt-get install -y git

# Clone xerus-pod
cd /opt
git clone ${REPO_URL} xerus-pod
cd xerus-pod
mkdir -p /opt/xerus-pod

echo '[cloud-init] Docker installed, repo cloned.'
echo '[cloud-init] Upload .env then run: cd /opt/xerus-pod && bash scripts/setup.sh --prod'
"

log "Provisioning Hetzner VPS..."
log "  Name:     $SERVER_NAME"
log "  Type:     $SERVER_TYPE"
log "  Location: $LOCATION"
log "  Image:    $IMAGE"
log "  SSH Key:  $SSH_KEY_NAME"

# Create server
SERVER_IP=$(hcloud server create \
    --name "$SERVER_NAME" \
    --type "$SERVER_TYPE" \
    --location "$LOCATION" \
    --image "$IMAGE" \
    --ssh-key "$SSH_KEY_NAME" \
    --user-data "$CLOUD_INIT" \
    --label "app=xerus-pod" \
    --label "env=production" \
    -o json | jq -r '.server.public_net.ipv4.ip')

log ""
log "VPS created!"
log "  IP: $SERVER_IP"
log ""
log "Next steps:"
log "  1. Wait ~30s for cloud-init to finish"
log "  2. Upload prod.env:"
log "     scp config/prod.env root@${SERVER_IP}:/opt/xerus-pod/.env"
log "  3. SSH in and complete setup:"
log "     ssh root@${SERVER_IP} 'cd /opt/xerus-pod && bash scripts/setup.sh --prod'"
log "  4. Get Daytona API key from dashboard:"
log "     http://${SERVER_IP}:3000/dashboard"
log "  5. Register snapshot:"
log "     ssh root@${SERVER_IP} 'cd /opt/xerus-pod && DAYTONA_API_KEY=<key> bash scripts/register-snapshot.sh'"
log "  6. Update xerus_backend .env:"
log "     DAYTONA_API_URL=http://${SERVER_IP}:3000/api"
log ""
log "To destroy: hcloud server delete $SERVER_NAME"
