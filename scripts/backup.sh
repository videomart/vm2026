#!/usr/bin/env bash
# Gera um dump do banco do container "db" para db/dump/<timestamp>.sql
set -euo pipefail
cd "$(dirname "$0")/.."

source .env

OUT_DIR="db/dump"
OUT_FILE="$OUT_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
mkdir -p "$OUT_DIR"

docker compose exec -T db sh -c \
  "mysqldump -u root -p\"\$MYSQL_ROOT_PASSWORD\" --databases \"\$MYSQL_DATABASE\" --routines --events --single-transaction" \
  > "$OUT_FILE"

echo "Backup salvo em: $OUT_FILE"
