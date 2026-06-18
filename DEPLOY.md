# Deploy do vm2026 em VPS

Domínio de produção: **vm2026.avideomart.com.br**

Pré-requisitos confirmados: VPS Ubuntu com Docker + Docker Compose já instalados, acesso
SSH root.

> ⚠️ Antes de começar: confirme que o registro **A** do domínio
> `vm2026.avideomart.com.br` já aponta para o IP público desta VPS. Sem isso, o Let's
> Encrypt (passo 7) não vai conseguir validar o domínio e o deploy ficará sem HTTPS.
> Teste com `dig vm2026.avideomart.com.br +short` — deve devolver o IP da VPS.

---

## 1. Clonar o projeto na VPS

```bash
ssh root@<IP_DA_VPS>
git clone git@github.com:videomart/vm2026.git
cd vm2026
```

Se o clone via SSH falhar (sem chave configurada na VPS), use HTTPS:
```bash
git clone https://github.com/videomart/vm2026.git
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
| `MYSQL_PASSWORD` | senha forte nova (diferente da root) |
| `DOMINIO` | `vm2026.avideomart.com.br` |
| `JWT_SECRET` | gerar com `openssl rand -hex 32` |
| `ADMIN_EMAIL` | seu e-mail de admin |
| `ADMIN_PASSWORD` | senha forte nova (você pode trocar depois via "esqueci minha senha") |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | uma das contas SMTP já configuradas (ex.: vm1@tvtupi.com.br) |
| `FRONTEND_URL` | `https://vm2026.avideomart.com.br` |

Gerar o `JWT_SECRET`:
```bash
openssl rand -hex 32
```

## 3. Preparar a config do Nginx com o domínio real

```bash
sed -i "s/SEU_DOMINIO/vm2026.avideomart.com.br/g" nginx/conf.d/vm2026.conf.http-only
sed -i "s/SEU_DOMINIO/vm2026.avideomart.com.br/g" nginx/conf.d/vm2026.conf.with-ssl
```

**Importante**: na primeira subida ainda não existe certificado TLS, então o Nginx precisa
rodar só com a config HTTP. Ative a versão "http-only" e deixe a versão "with-ssl" de lado
por enquanto:

```bash
mv nginx/conf.d/vm2026.conf.with-ssl nginx/conf.d/vm2026.conf.with-ssl.disabled
cp nginx/conf.d/vm2026.conf.http-only nginx/conf.d/vm2026.conf
```

## 4. Criar a senha do phpMyAdmin (HTTP Basic Auth)

```bash
sudo apt-get update && sudo apt-get install -y apache2-utils
htpasswd -c nginx/htpasswd/phpmyadmin admin
```
(escolha uma senha forte, diferente da senha de admin do sistema e do banco)

## 5. Criar a pasta do desafio do certbot

```bash
mkdir -p certbot-webroot
```

## 6. Subir os containers (ainda sem HTTPS)

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Confirme que abre em HTTP por enquanto:
```bash
curl -I http://vm2026.avideomart.com.br
```
Deve responder `200` com o texto "aguardando emissão do certificado TLS".

## 7. Emitir o certificado TLS (Let's Encrypt, modo webroot)

Como a porta 80 já está ocupada pelo container `proxy`, usamos o modo **webroot** (não
`--standalone`) — o certbot só precisa escrever um arquivo que o Nginx já está servindo em
`/.well-known/acme-challenge/`:

```bash
docker run -it --rm \
  -v "$(pwd)/nginx/certs:/etc/letsencrypt" \
  -v "$(pwd)/certbot-webroot:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  --webroot-path /var/www/certbot \
  -d vm2026.avideomart.com.br
```

Se tudo der certo, o certbot mostra `Successfully received certificate` e os arquivos ficam
em `nginx/certs/live/vm2026.avideomart.com.br/`.

## 8. Ativar a config com HTTPS

```bash
mv nginx/conf.d/vm2026.conf nginx/conf.d/vm2026.conf.http-only.used
mv nginx/conf.d/vm2026.conf.with-ssl.disabled nginx/conf.d/vm2026.conf
docker compose -f docker-compose.prod.yml restart proxy
```

Teste:
```bash
curl -I https://vm2026.avideomart.com.br
```
Deve responder `200` (ou redirecionamento) sem erro de certificado.

## 9. Renovação automática do certificado (crontab)

```bash
crontab -e
```
Adicione (ajustando o caminho real do projeto):
```
0 3 * * * docker run --rm -v /root/vm2026/nginx/certs:/etc/letsencrypt -v /root/vm2026/certbot-webroot:/var/www/certbot certbot/certbot renew --quiet && docker compose -f /root/vm2026/docker-compose.prod.yml restart proxy
```

## 10. Importar o banco de dados

No ambiente de origem (onde está o banco atual com os dados reais):
```bash
docker exec vm2026-db-1 mysqldump -u vm2026 -p<senha_atual_dev> vm2026 > vm2026_producao.sql
```

Copiar o arquivo para a VPS:
```bash
scp vm2026_producao.sql root@<IP_DA_VPS>:/root/vm2026/
```

Importar dentro do container do banco de produção:
```bash
docker compose -f docker-compose.prod.yml exec -T db \
  mysql -u vm2026 -p"$(grep MYSQL_PASSWORD .env | cut -d= -f2)" vm2026 < vm2026_producao.sql
```

## 11. Criar/confirmar o usuário admin

Se o dump já trouxe usuários ativos, pule esta etapa. Senão:
```bash
docker compose -f docker-compose.prod.yml exec backend npm run seed:admin
```

## 12. Cadastrar as contas SMTP (se não vieram no dump)

Acesse `https://vm2026.avideomart.com.br` → login → Configurações → Contas SMTP, e
recadastre as 10 contas (vm1 a vm10@tvtupi.com.br) se a tabela `contas_smtp` não veio
populada no dump importado.

## 13. Verificação final

| Checagem | Resultado esperado |
|---|---|
| `https://vm2026.avideomart.com.br` | tela de login do sistema |
| `https://vm2026.avideomart.com.br/api/health` | `{"status":"ok","database":"conectado"}` |
| `https://vm2026.avideomart.com.br/phpmyadmin/` | pede usuário/senha do Basic Auth primeiro, depois login do phpMyAdmin (usuário/senha do MySQL) |
| Login com o admin | entra normalmente |
| "Esqueci minha senha" | e-mail chega com o link de redefinição |

---

## Pendências conhecidas pós-deploy (não bloqueiam, mas não esquecer)

- **Site institucional**: repontar o formulário de captação de leads para
  `POST https://vm2026.avideomart.com.br/api/leads/captura` (ver detalhes do formato em
  memória do projeto — campos aceitos e validação)
- **Limite das contas SMTP**: está reduzido para 20 e-mails/dia por conta (período de
  aquecimento após suspensão da Hostinger) — reavaliar subir para 100/dia depois de alguns
  dias sem nova suspensão
- **Backup do banco**: este guia não inclui rotina de backup automático — recomenda-se
  configurar um cron de `mysqldump` periódico assim que o sistema estiver em produção real
