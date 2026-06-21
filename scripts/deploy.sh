#!/usr/bin/env bash
# Deploy de produção: git pull + rebuild sem cache + restart + migrations.
#
# docker-compose.yml (sem sufixo) é o de PRODUÇÃO nesta VPS — de propósito,
# para que "docker compose up -d --build" simples, sem "-f", já seja sempre
# seguro de rodar aqui. O de desenvolvimento é o que tem sufixo:
# docker-compose.dev.yml (só usado na máquina local de dev, nunca na VPS).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> git pull"
git pull

echo "==> build sem cache (garante que o build novo do frontend/backend entra na imagem)"
echo "    versão exibida no rodapé vem de frontend/src/buildInfo.ts — atualizar a cada commit relevante"
docker compose build --no-cache backend

echo "==> subindo containers de produção"
docker compose up -d

echo "==> aplicando migrations pendentes (todas são idempotentes — IF NOT EXISTS)"
echo "    evita o erro 'Unknown column' quando uma migration nova só foi aplicada em dev"
echo "    --default-character-set=utf8mb4 evita corromper acentos (ex.: 'Manutenção' -> 'ManutenÃ§Ã£o')"
for f in db/migrations/*.sql; do
  cat "$f" | docker compose exec -T db mysql --default-character-set=utf8mb4 -u "${MYSQL_USER:-vm2026}" -p"$(grep MYSQL_PASSWORD .env | cut -d= -f2)" "${MYSQL_DATABASE:-vm2026}"
done

echo "==> status final"
docker compose ps
