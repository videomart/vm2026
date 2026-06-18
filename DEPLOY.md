# Deploy do vm2026 em VPS

Pré-requisito: VPS com Docker + Docker Compose instalados (Ubuntu 22.04+), acesso SSH
root, e o domínio já apontando (registro A) para o IP do VPS.

## 1. Clonar o projeto no VPS

```bash
git clone git@github.com:videomart/vm2026.git
cd vm2026
```

## 2. Configurar variáveis de ambiente de produção

```bash
cp .env.production.example .env
nano .env   # preencher senhas novas (nunca reaproveitar as de dev), DOMINIO, etc.
```

Gerar `JWT_SECRET`:
```bash
openssl rand -hex 32
```

## 3. Editar o domínio na config do Nginx

```bash
sed -i "s/SEU_DOMINIO/$(grep DOMINIO .env | cut -d= -f2)/g" nginx/conf.d/vm2026.conf
```

## 4. Criar a senha do phpMyAdmin (Basic Auth)

```bash
sudo apt-get install -y apache2-utils   # fornece o comando htpasswd
htpasswd -c nginx/htpasswd/phpmyadmin admin
# escolha uma senha — diferente da senha de admin do sistema/banco
```

## 5. Subir os containers (sem TLS ainda, para o certbot conseguir validar)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## 6. Emitir o certificado TLS (Let's Encrypt)

```bash
mkdir -p nginx/certs
docker run -it --rm \
  -v "$(pwd)/nginx/certs:/etc/letsencrypt" \
  -v "$(pwd)/certbot-webroot:/var/www/certbot" \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d "$(grep DOMINIO .env | cut -d= -f2)"
```

Depois de emitido, reinicie o proxy para carregar o certificado:
```bash
docker compose -f docker-compose.prod.yml restart proxy
```

Renovação automática (crontab):
```bash
0 3 * * * docker run --rm -v /caminho/vm2026/nginx/certs:/etc/letsencrypt certbot/certbot renew --quiet && docker compose -f /caminho/vm2026/docker-compose.prod.yml restart proxy
```

## 7. Importar o banco de dados (dump do ambiente atual)

No ambiente de origem (dev/staging):
```bash
docker exec vm2026-db-1 mysqldump -u vm2026 -p<senha_atual> vm2026 > vm2026_producao.sql
```

Copiar o arquivo para o VPS (scp) e importar:
```bash
docker compose -f docker-compose.prod.yml exec -T db \
  mysql -u vm2026 -p"$(grep MYSQL_PASSWORD .env | cut -d= -f2)" vm2026 < vm2026_producao.sql
```

## 8. Criar o usuário admin (se o dump não trouxe um ativo)

```bash
docker compose -f docker-compose.prod.yml exec backend npm run seed:admin
```

## 9. Verificação final

- `https://SEU_DOMINIO` → tela de login do sistema
- `https://SEU_DOMINIO/api/health` → `{"status":"ok","database":"conectado"}`
- `https://SEU_DOMINIO/phpmyadmin/` → pede usuário/senha do Basic Auth primeiro, depois
  tela de login do phpMyAdmin (usar usuário/senha do MySQL, não o admin do sistema)

## Pendências conhecidas (ver memória do projeto)

- Reset de senha por e-mail ainda não implementado
- Site institucional ainda grava leads no vm2025, não no endpoint `/api/leads/captura`
  deste sistema — ajustar antes ou logo após o deploy
- Limite de envio das contas SMTP (`contas_smtp.limite_dia`) está reduzido para 20/dia
  como medida de aquecimento após suspensão da Hostinger — reavaliar subir para 100/dia
  depois de um período sem novas suspensões
