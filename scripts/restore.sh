#!/usr/bin/env bash
# Restaura um dump .sql para dentro do container "db"
# Uso: ./scripts/restore.sh caminho/para/arquivo.sql
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "Uso: $0 caminho/para/arquivo.sql"
  exit 1
fi

DUMP_FILE="$1"
if [ ! -f "$DUMP_FILE" ]; then
  echo "Arquivo não encontrado: $DUMP_FILE"
  exit 1
fi

source .env

cat "$DUMP_FILE" | docker compose exec -T db sh -c \
  "mysql -u root -p\"\$MYSQL_ROOT_PASSWORD\" \"\$MYSQL_DATABASE\""

echo "Restauração concluída a partir de: $DUMP_FILE"
