# vm2026 — LEIA ANTES DE QUALQUER COISA (atualizado em 2026-06-07)

> ⚠️ Este arquivo substitui qualquer suposição anterior.

## DECISÃO DE ESCOPO — A MAIS IMPORTANTE DO PROJETO

Bolais definiu (2026-06-07) que o vm2026 **NÃO é uma migração do vm2025**:

> "não será uma migração do vm2025. Faremos um novo sistema muito mais enxuto e focado objetivamente para as nossas necessidades."

- **Stack: React (frontend) + Node/Express (backend/API) + MySQL** (não PHP, não ScriptCase). Confirmado e já implementado em 2026-06-07: o ambiente Docker PHP/Apache foi **substituído** por containers `frontend` (React+Vite), `backend` (Node+Express) e `db` (MySQL).
- O banco migrado do vm2025 (46 tabelas) é, no máximo, **referência de dados/legado** — fica em `db/legado/migrado_de_vm2025.sql`, não carregado automaticamente. O container `db` sobe **vazio**; o schema novo ainda precisa ser desenhado do zero, mais enxuto (ex.: sem campos obsoletos como "fax").

## ESCOPO FUNCIONAL COMBINADO (use como guia de planejamento)

**Módulos padrão de CRM:**
- Cadastro de clientes, produtos, propostas
- Transformação de proposta em venda → inserida automaticamente como conta a receber
- Impressão de propostas e envio de propostas por e-mail

**Funcionalidades fora do padrão:**
1. Envio de e-mails episódicos para grupos selecionados (ex.: avisar clientes para atualizar o TVPlay, com link/PDF)
2. Integração do pipeline de vendas com o site da empresa: leads gravados pelo site numa tabela devem ser tratados pelos vendedores no ambiente de vendas

**Autenticação / controle de acesso:**
- Tela inicial de login
- Vendedores são freelancers com rotatividade → controle de acesso que permita bloquear vendedor marcado como inativo
- Recriação/redefinição de senha (perdida ou expirada)

**Tela inicial:**
- Dashboard pós-login com resumo de vendas/propostas/leads, com visões semana/mês/ano

## Estado da infraestrutura

- Containers Docker: `frontend` (React + Vite, porta `FRONTEND_PORT`=8082), `backend` (Node + Express, porta `BACKEND_PORT`=8083) e `db` (MySQL, porta `DB_PORT`=3307).
- `frontend/` e `backend/` são **esqueletos mínimos**: tela inicial do React chama `GET /api/health` no backend, que testa a conexão com o MySQL via `mysql2`.
- Banco `db` sobe **vazio** (volume `db_data` novo) — schema definitivo ainda não foi desenhado.
- Dump migrado do vm2025 (46 tabelas) preservado em `db/legado/migrado_de_vm2025.sql`, só como referência — **não** carregado automaticamente (pasta `db/init/` é a que o MySQL lê no entrypoint, e está vazia/aguardando o schema novo).
- Repositório sincronizado: `git@github.com:videomart/vm2026.git`, branch `main`.

## O que fazer ao retomar este projeto

1. O ambiente Docker já foi migrado para React + Node/Express + MySQL (não presuma mais PHP/Apache/ScriptCase).
2. Trate o schema do banco como **a desenhar do zero** — `db/init/` está vazio, aguardando os scripts SQL do schema novo, alinhados aos módulos listados acima.
3. Ao planejar/desenvolver, cubra os módulos e requisitos do escopo combinado (lista acima) — não invente módulos fora dessa lista sem confirmar.
4. **Salve imediatamente em memória** qualquer novo detalhe, refinamento ou decisão técnica que surgir — replicando entre as memórias dos projetos vm2025 e vm2026 (instrução explícita do usuário, registrada em `feedback_save_everything.md`). Não espere ele pedir de novo.
