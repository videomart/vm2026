#!/usr/bin/env bash
# Deploy de produção: git pull + rebuild (com cache de camadas) + restart + migrations.
# Equivalente a "git pull && docker compose up -d --build" + aplicar migrations —
# use este script para não esquecer das migrations, mas o build em si não precisa
# de --no-cache no dia a dia (ver comentário abaixo).
#
# docker-compose.yml (sem sufixo) é o de PRODUÇÃO nesta VPS — de propósito,
# para que "docker compose up -d --build" simples, sem "-f", já seja sempre
# seguro de rodar aqui. O de desenvolvimento é o que tem sufixo:
# docker-compose.dev.yml (só usado na máquina local de dev, nunca na VPS).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> git pull"
git pull

echo "==> build (com cache de camadas — o Dockerfile copia package*.json antes do"
echo "    código, então npm ci/apt-get só reroda quando essas dependências mudam;"
echo "    qualquer arquivo alterado em backend/ ou frontend/ invalida o cache a partir"
echo "    do COPY do código, então a versão nova SEMPRE entra na imagem)"
echo "    versão exibida no rodapé vem de frontend/src/buildInfo.ts — atualizar a cada commit relevante"
docker compose build backend

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
