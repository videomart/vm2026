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

echo "==> build sem cache (garante que o build novo do frontend/backend entra na imagem)"
$COMPOSE build --no-cache backend

echo "==> subindo containers de produção"
$COMPOSE up -d

echo "==> status final"
$COMPOSE ps
