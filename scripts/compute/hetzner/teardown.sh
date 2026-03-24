#!/usr/bin/env bash
# Teardown a Hetzner VPS running xerus-pod
#
# Usage:
#   ./scripts/teardown-hetzner.sh xerus-pod-1     # By name
#   ./scripts/teardown-hetzner.sh --all            # All xerus-pod servers

set -euo pipefail

log() { echo "[hetzner:teardown] $*"; }
err() { echo "[hetzner:teardown] ERROR: $*" >&2; exit 1; }

if ! command -v hcloud &>/dev/null; then
    err "hcloud CLI not installed"
fi

if [[ "${1:-}" == "--all" ]]; then
    log "Finding all xerus-pod servers..."
    SERVERS=$(hcloud server list -l app=xerus-pod -o noheader -o columns=name)

    if [[ -z "$SERVERS" ]]; then
        log "No xerus-pod servers found"
        exit 0
    fi

    echo "$SERVERS" | while read -r name; do
        log "Deleting $name..."
        hcloud server delete "$name"
        log "$name deleted"
    done
elif [[ -n "${1:-}" ]]; then
    SERVER_NAME="$1"
    log "Deleting $SERVER_NAME..."
    hcloud server delete "$SERVER_NAME"
    log "$SERVER_NAME deleted"
else
    echo "Usage: $0 <server-name> | --all"
    exit 1
fi
