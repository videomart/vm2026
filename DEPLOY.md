# Deploy do vm2026 em VPS

Domínio de produção: **vm2026.avideomart.com.br**
phpMyAdmin: **phpmyadmin-vm2026.avideomart.com.br**

## Contexto desta VPS

Esta VPS já hospeda outro sistema (`tvplay-web`) com `nginx-proxy` + `acme-companion`
rodando nas portas 80/443 (rede Docker `tvplay-web_default`). Em vez de subir um Nginx e
certbot próprios — que entrariam em conflito de porta —, conectamos os containers do
vm2026 a essa mesma rede e deixamos o `nginx-proxy` existente detectar e gerar o virtual
host + certificado Let's Encrypt automaticamente, via variáveis de ambiente
(`VIRTUAL_HOST` / `LETSENCRYPT_HOST`).

O backend também serve o build do frontend (via `express.static`), então só existe **um**
container web por domínio — evita o problema de rotear `/api` e `/` para containers
diferentes no mesmo host, que o `nginx-proxy` não resolve de forma confiável via path.

> ⚠️ Confirme que os registros DNS (tipo A) de `vm2026.avideomart.com.br` **e**
> `phpmyadmin-vm2026.avideomart.com.br` já apontam para o IP desta VPS antes do passo 5
> (senão o Let's Encrypt não consegue validar e o `acme-companion` fica retentando).
> Teste com `dig vm2026.avideomart.com.br +short`.

---

## 1. Clonar o projeto na VPS

```bash
git clone https://github.com/videomart/vm2026.git
cd vm2026
```

## 2. Configurar variáveis de ambiente de produção

```bash
cp .env.production.example .env
nano .env
```

Preencha (gerando senhas **novas**, nunca reaproveite as de desenvolvimento):

| Variável | Valor |
|---|---|
| `MYSQL_ROOT_PASSWORD` | senha forte nova |
| `MYSQL_PASSWORD` | outra senha forte nova |
| `DOMINIO` | `vm2026.avideomart.com.br` |
| `DOMINIO_BASE` | `avideomart.com.br` |
| `JWT_SECRET` | gerar com `openssl rand -hex 32` |
| `ADMIN_EMAIL` | seu e-mail de admin |
| `ADMIN_PASSWORD` | senha forte nova (pode trocar depois via "esqueci minha senha") |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | uma das contas SMTP já configuradas (ex.: vm1@tvtupi.com.br) |
| `FRONTEND_URL` | `https://vm2026.avideomart.com.br` |

```bash
openssl rand -hex 32   # cole o resultado em JWT_SECRET
```

## 3. Subir os containers

O build é feito a partir da raiz do projeto (o backend empacota o frontend também):

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Acompanhe os logs do backend até ele terminar de subir:
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```
(`Ctrl+C` para sair do log depois de ver "vm2026 backend ouvindo na porta 3001")

## 4. Verificar que o nginx-proxy detectou os novos containers

```bash
docker logs tvplay_proxy --tail=50
```
Deve aparecer algo como "Generated new nginx config" ou similar mencionando os
containers do vm2026 (nomes terminam em `_backend_1` ou `-backend-1`, dependendo da
versão do compose).

## 5. Aguardar a emissão automática do certificado TLS

O `acme-companion` (`tvplay_acme`) detecta o `LETSENCRYPT_HOST` automaticamente e emite o
certificado sem comando manual. Acompanhe:

```bash
docker logs tvplay_acme --tail=50 -f
```

Procure por algo como "Creating/renewal vm2026.avideomart.com.br certificate" e depois
confirmação de sucesso. Pode levar 1-2 minutos. Se a `phpmyadmin-vm2026...` também aparecer,
ótimo — os dois domínios são emitidos juntos.

## 6. Testar HTTPS

```bash
curl -I https://vm2026.avideomart.com.br
curl -s https://vm2026.avideomart.com.br/api/health
```

O `health` deve responder `{"status":"ok","database":"conectado"}` (se o banco já estiver
populado — senão "falha na conexão" é esperado até o próximo passo).

## 7. Importar o banco de dados

No ambiente de origem (onde está o banco atual com os dados reais):
```bash
docker exec vm2026-db-1 mysqldump -u vm2026 -p<senha_atual_dev> vm2026 > vm2026_producao.sql
```

Copiar para a VPS:
```bash
scp vm2026_producao.sql usuario@<IP_DA_VPS>:~/vm2026/
```

Importar dentro do container do banco de produção:
```bash
docker compose -f docker-compose.prod.yml exec -T db \
  mysql -u vm2026 -p"$(grep MYSQL_PASSWORD .env | cut -d= -f2)" vm2026 < vm2026_producao.sql
```

## 8. Criar/confirmar o usuário admin

Se o dump já trouxe usuários ativos, pule esta etapa. Senão:
```bash
docker compose -f docker-compose.prod.yml exec backend npm run seed:admin
```

## 9. Cadastrar as contas SMTP (se não vieram no dump)

Login em `https://vm2026.avideomart.com.br` → Configurações → Contas SMTP → recadastrar
as 10 contas (vm1 a vm10@tvtupi.com.br) se a tabela `contas_smtp` não veio populada.

## 10. Verificação final

| Checagem | Resultado esperado |
|---|---|
| `https://vm2026.avideomart.com.br` | tela de login do sistema |
| `https://vm2026.avideomart.com.br/api/health` | `{"status":"ok","database":"conectado"}` |
| `https://phpmyadmin-vm2026.avideomart.com.br` | tela de login do phpMyAdmin (usuário/senha do MySQL) |
| Login com o admin | entra normalmente |
| "Esqueci minha senha" | e-mail chega com o link de redefinição |

---

## Pendências conhecidas pós-deploy (não bloqueiam, mas não esquecer)

- **phpMyAdmin sem camada extra de senha**: como não há Nginx próprio para Basic Auth,
  o phpMyAdmin fica só protegido pela própria tela de login (usuário/senha do MySQL).
  Considere restringir por firewall/IP se for ficar exposto por muito tempo.
- **Site institucional**: repontar o formulário de captação de leads para
  `POST https://vm2026.avideomart.com.br/api/leads/captura` (ver memória do projeto para
  campos aceitos e validação)
- **Limite das contas SMTP**: reduzido para 20 e-mails/dia por conta (aquecimento após
  suspensão da Hostinger) — reavaliar subir para 100/dia depois de alguns dias estáveis
- **Backup do banco**: configurar uma rotina de `mysqldump` periódico assim que o sistema
  estiver em produção real — este guia não inclui isso
