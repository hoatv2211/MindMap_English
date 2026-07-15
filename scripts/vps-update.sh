#!/usr/bin/env bash
set -euo pipefail
IMAGE="${IMAGE:-ghcr.io/hoatv2211/mindmap_english:latest}"
NAME="${NAME:-mindmap-english}"
DATA_VOLUME="${DATA_VOLUME:-mindmap_english_data}"
PORT="${PORT:-8787}"

docker pull "$IMAGE"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker volume create "$DATA_VOLUME" >/dev/null

docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  -p "$PORT:8787" \
  -e NODE_ENV=production \
  -e HOST=0.0.0.0 \
  -e PORT=8787 \
  -e DATA_DIR=/data \
  -e ALLOW_REMOTE_BINDING=true \
  -e AUTH_SECURE_COOKIES=false \
  -v "$DATA_VOLUME:/data" \
  "$IMAGE"

docker ps --filter "name=$NAME"
