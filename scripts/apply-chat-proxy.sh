#!/usr/bin/env bash
set -euo pipefail

CADDY_CONTAINER="${CADDY_CONTAINER:-artisanalbrew-caddy-1}"
CADDY_FILE="${CADDY_FILE:-/opt/artisanalbrew/Caddyfile}"
CADDY_CANDIDATE=$(mktemp /tmp/private-chat-caddy.XXXXXX)
CADDY_PREVIOUS=$(mktemp /tmp/private-chat-caddy-before.XXXXXX)
trap 'rm -f "$CADDY_CANDIDATE" "$CADDY_PREVIOUS"' EXIT

cp "$CADDY_FILE" "$CADDY_PREVIOUS"
python3 scripts/render-chat-caddy.py "$CADDY_FILE" infra/Caddyfile.atlantic > "$CADDY_CANDIDATE"
docker exec -i "$CADDY_CONTAINER" caddy validate --config /dev/stdin --adapter caddyfile < "$CADDY_CANDIDATE"
# Preserve the destination inode because the shared proxy uses a bind mount.
sudo cp "$CADDY_CANDIDATE" "$CADDY_FILE"
if ! docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    sudo cp "$CADDY_PREVIOUS" "$CADDY_FILE"
    docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
    exit 1
fi
