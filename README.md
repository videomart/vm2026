# vm2026

Evolução/substituição do CRM **vm2025** (Videomart), gerado pela ferramenta visual **ScriptCase**.
Roda em ambiente Docker (PHP 8.1 + Apache + MySQL 8.0), em paralelo ao vm2025 (que continua em produção/uso).

## Status atual

- Ambiente Docker pronto e funcional.
- Banco de dados já migrado a partir de um dump do vm2025 (46 tabelas), renomeado de `vm2025` para `vm2026`.
- Pasta `www/` ainda vazia: o código do novo CRM será gerado/exportado pelo ScriptCase e colocado aqui quando o desenvolvimento visual começar.

## Subindo o ambiente

```bash
cp .env.example .env   # ajuste as senhas antes de subir
docker compose up -d
```

- App: http://localhost:8082
- MySQL: `localhost:3307` (usuário/senha conforme `.env`)

> O vm2025 roda em paralelo nas portas 8081 (web) e 3306 (MySQL) — sem conflito.

## Backup e restauração do banco

```bash
./scripts/backup.sh                  # gera db/dump/backup_<timestamp>.sql
./scripts/restore.sh db/dump/arquivo.sql
```

## Migração inicial do banco (vm2025 → vm2026)

O ponto de partida do banco `vm2026` foi criado a partir de um dump do `vm2025`:

1. Gerar backup do vm2025 (`./scripts/backup.sh` no projeto vm2025).
2. Substituir as ocorrências de `vm2025` por `vm2026` no dump (`CREATE DATABASE` / `USE`).
3. Restaurar o dump tratado neste ambiente (`./scripts/restore.sh`).

## Notas

- `.env`, dumps `.sql` em `db/dump/` e backups `*.bak` ficam fora do versionamento (ver `.gitignore`).
- Quando o código do ScriptCase for colocado em `www/`, o `.gitignore` provavelmente precisará ser expandido para excluir cache/tmp gerados pelo sistema (mesmo padrão aplicado no vm2025).
