# vm2026

CRM novo da Videomart, escrito do zero (não é uma migração do vm2025) — stack **React + Node/Express + MySQL**, em ambiente Docker, rodando em paralelo ao vm2025 (que continua em produção/uso).

## Status atual

- Ambiente Docker com 3 serviços: `frontend` (React + Vite), `backend` (Node + Express) e `db` (MySQL 8.0).
- `frontend/` e `backend/` são esqueletos mínimos (scaffold) — a tela inicial do React consulta `/api/health` no backend, que verifica a conexão com o MySQL.
- Banco `db` sobe **vazio**: o schema definitivo do vm2026 ainda será desenhado do zero, mais enxuto que o do vm2025 (ver módulos/requisitos combinados no `CLAUDE.md`).
- O dump migrado do vm2025 (46 tabelas) fica em `db/legado/`, só como referência de dados/legado — não é carregado automaticamente.

## Subindo o ambiente

```bash
cp .env.example .env   # ajuste as senhas antes de subir
docker compose up -d --build
```

- Frontend: http://localhost:8082
- Backend (API): http://localhost:8083/api/health
- MySQL: `localhost:3307` (usuário/senha conforme `.env`)

> O vm2025 roda em paralelo nas portas 8081 (web) e 3306 (MySQL) — sem conflito.

## Desenvolvimento

- `frontend/` e `backend/` rodam com hot-reload (volumes montados); editar o código local reflete direto nos containers.
- Para rodar comandos npm dentro dos containers: `docker compose exec frontend npm <comando>` / `docker compose exec backend npm <comando>`.

## Backup e restauração do banco

```bash
./scripts/backup.sh                  # gera db/legado/backup_<timestamp>.sql
./scripts/restore.sh db/legado/arquivo.sql
```

## Banco de dados

- `db/init/`: scripts `.sql` carregados automaticamente na primeira subida do MySQL (schema novo, a ser criado).
- `db/legado/migrado_de_vm2025.sql`: dump migrado do vm2025 (46 tabelas), mantido só como referência de dados/legado — **não** é carregado automaticamente.

## Notas

- `.env`, dumps `.sql` em `db/legado/` e `db/init/`, e backups `*.bak` ficam fora do versionamento (ver `.gitignore`).
- `node_modules/`, `dist/` e `build/` do frontend e backend também ficam fora do versionamento.
