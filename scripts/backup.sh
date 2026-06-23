#!/usr/bin/env bash
# Gera um dump comprimido do banco do container "db" para db/legado/<timestamp>.sql.gz
# e apaga backups com mais de RETENCAO_DIAS dias.
set -euo pipefail
cd "$(dirname "$0")/.."

source .env

OUT_DIR="db/legado"
OUT_FILE="$OUT_DIR/backup_$(date +%Y%m%d_%H%M%S).sql.gz"
RETENCAO_DIAS=14
mkdir -p "$OUT_DIR"

docker compose exec -T db sh -c \
  "mysqldump -u root -p\"\$MYSQL_ROOT_PASSWORD\" --databases \"\$MYSQL_DATABASE\" --routines --events --single-transaction" \
  | gzip > "$OUT_FILE"

find "$OUT_DIR" -name 'backup_*.sql.gz' -mtime "+$RETENCAO_DIAS" -delete

echo "Backup salvo em: $OUT_FILE"
