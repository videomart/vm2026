#!/usr/bin/env bash
# Deploy de produção: git pull + rebuild sem cache + restart, sempre usando
# docker-compose.prod.yml — existe para nunca esquecer o "-f", já que o
# diretório também tem um docker-compose.yml de desenvolvimento e o Docker
# usa esse por padrão se "-f" não for informado (causa real de quedas
# anteriores: rebuild rodado sem "-f" subiu os containers de dev por engano,
# sem VIRTUAL_HOST/LETSENCRYPT_HOST, e o nginx-proxy parou de rotear).
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> git pull"
git pull

echo "==> derrubando containers de DEV, se existirem por engano"
docker compose down --remove-orphans 2>/dev/null || true

export APP_VERSION="$(git rev-parse --short HEAD) ($(git log -1 --format=%cd --date=format:%Y-%m-%d))"
echo "==> build sem cache (garante que o build novo do frontend/backend entra na imagem) — versão: $APP_VERSION"
$COMPOSE build --no-cache backend

echo "==> subindo containers de produção"
$COMPOSE up -d

echo "==> aplicando migrations pendentes (todas são idempotentes — IF NOT EXISTS)"
echo "    evita o erro 'Unknown column' quando uma migration nova só foi aplicada em dev"
for f in db/migrations/*.sql; do
  cat "$f" | $COMPOSE exec -T db mysql -u "${MYSQL_USER:-vm2026}" -p"$(grep MYSQL_PASSWORD .env | cut -d= -f2)" "${MYSQL_DATABASE:-vm2026}"
done

echo "==> status final"
$COMPOSE ps
