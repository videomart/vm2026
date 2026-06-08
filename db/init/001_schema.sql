-- Schema inicial do vm2026 (desenhado do zero, não migrado do vm2025)
-- Cobre os módulos centrais: usuários/autenticação, clientes, produtos,
-- propostas -> vendas -> contas a receber, leads e e-mails em massa.

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- usuarios: login e controle de acesso (vendedores e administradores)
-- ----------------------------------------------------------------------------
CREATE TABLE usuarios (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  senha_hash    VARCHAR(255) NOT NULL,
  papel         ENUM('admin', 'vendedor') NOT NULL DEFAULT 'vendedor',
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- redefinicoes_senha: tokens para recuperação/redefinição de senha
-- ----------------------------------------------------------------------------
CREATE TABLE redefinicoes_senha (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NOT NULL,
  token      VARCHAR(255) NOT NULL,
  expira_em  DATETIME NOT NULL,
  usado_em   DATETIME DEFAULT NULL,
  criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_redefinicoes_token (token),
  KEY idx_redefinicoes_usuario (usuario_id),
  CONSTRAINT fk_redefinicoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- clientes: cadastro de clientes (versão enxuta, sem campos obsoletos)
-- ----------------------------------------------------------------------------
CREATE TABLE clientes (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  razao_social  VARCHAR(200) NOT NULL,
  nome_fantasia VARCHAR(200) DEFAULT NULL,
  cnpj_cpf      VARCHAR(20) DEFAULT NULL,
  email         VARCHAR(150) DEFAULT NULL,
  telefone      VARCHAR(20) DEFAULT NULL,
  whatsapp      VARCHAR(20) DEFAULT NULL,
  endereco      VARCHAR(200) DEFAULT NULL,
  cidade        VARCHAR(100) DEFAULT NULL,
  uf            CHAR(2) DEFAULT NULL,
  cep           VARCHAR(10) DEFAULT NULL,
  observacoes   TEXT,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clientes_razao_social (razao_social),
  KEY idx_clientes_cnpj_cpf (cnpj_cpf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- produtos: cadastro de produtos
-- ----------------------------------------------------------------------------
CREATE TABLE produtos (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  modelo        VARCHAR(50) NOT NULL,
  descricao     VARCHAR(200) DEFAULT NULL,
  marca         VARCHAR(80) DEFAULT NULL,
  categoria     VARCHAR(80) DEFAULT NULL,
  preco_custo   DECIMAL(12,2) DEFAULT NULL,
  preco_venda   DECIMAL(12,2) DEFAULT NULL,
  peso          DECIMAL(10,3) DEFAULT NULL,
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produtos_modelo (modelo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- propostas: propostas comerciais enviadas a clientes
-- ----------------------------------------------------------------------------
CREATE TABLE propostas (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id           INT UNSIGNED NOT NULL,
  vendedor_id          INT UNSIGNED NOT NULL,
  data                 DATE NOT NULL,
  validade             DATE DEFAULT NULL,
  condicoes_pagamento  VARCHAR(200) DEFAULT NULL,
  observacoes          TEXT,
  status               ENUM('aberta', 'aprovada', 'recusada', 'convertida') NOT NULL DEFAULT 'aberta',
  total                DECIMAL(12,2) NOT NULL DEFAULT 0,
  desconto             DECIMAL(12,2) NOT NULL DEFAULT 0,
  criado_em            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_propostas_cliente (cliente_id),
  KEY idx_propostas_vendedor (vendedor_id),
  KEY idx_propostas_status (status),
  CONSTRAINT fk_propostas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id),
  CONSTRAINT fk_propostas_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- proposta_itens: itens (produtos) de cada proposta
-- ----------------------------------------------------------------------------
CREATE TABLE proposta_itens (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposta_id     INT UNSIGNED NOT NULL,
  produto_id      INT UNSIGNED DEFAULT NULL,
  descricao       VARCHAR(200) NOT NULL,
  quantidade      DECIMAL(10,2) NOT NULL DEFAULT 1,
  valor_unitario  DECIMAL(12,2) NOT NULL DEFAULT 0,
  desconto        DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_proposta_itens_proposta (proposta_id),
  KEY idx_proposta_itens_produto (produto_id),
  CONSTRAINT fk_proposta_itens_proposta FOREIGN KEY (proposta_id) REFERENCES propostas (id) ON DELETE CASCADE,
  CONSTRAINT fk_proposta_itens_produto FOREIGN KEY (produto_id) REFERENCES produtos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- vendas: gerada ao converter uma proposta em venda (1:1 com proposta)
-- ----------------------------------------------------------------------------
CREATE TABLE vendas (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposta_id  INT UNSIGNED NOT NULL,
  cliente_id   INT UNSIGNED NOT NULL,
  vendedor_id  INT UNSIGNED NOT NULL,
  data         DATE NOT NULL,
  total        DECIMAL(12,2) NOT NULL DEFAULT 0,
  criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vendas_proposta (proposta_id),
  KEY idx_vendas_cliente (cliente_id),
  KEY idx_vendas_vendedor (vendedor_id),
  CONSTRAINT fk_vendas_proposta FOREIGN KEY (proposta_id) REFERENCES propostas (id),
  CONSTRAINT fk_vendas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id),
  CONSTRAINT fk_vendas_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- contas_a_receber: inserida automaticamente ao criar a venda
-- ----------------------------------------------------------------------------
CREATE TABLE contas_a_receber (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  venda_id    INT UNSIGNED NOT NULL,
  descricao   VARCHAR(200) DEFAULT NULL,
  valor       DECIMAL(12,2) NOT NULL,
  vencimento  DATE NOT NULL,
  status      ENUM('pendente', 'pago', 'atrasado') NOT NULL DEFAULT 'pendente',
  pago_em     DATETIME DEFAULT NULL,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contas_receber_venda (venda_id),
  KEY idx_contas_receber_status (status),
  CONSTRAINT fk_contas_receber_venda FOREIGN KEY (venda_id) REFERENCES vendas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- leads: capturados pelo site, tratados pelos vendedores
-- ----------------------------------------------------------------------------
CREATE TABLE leads (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome_empresa VARCHAR(150) DEFAULT NULL,
  contato      VARCHAR(150) DEFAULT NULL,
  telefone     VARCHAR(20) DEFAULT NULL,
  email        VARCHAR(150) DEFAULT NULL,
  cidade       VARCHAR(100) DEFAULT NULL,
  uf           CHAR(2) DEFAULT NULL,
  assunto      VARCHAR(120) DEFAULT NULL,
  mensagem     TEXT,
  origem       VARCHAR(80) DEFAULT NULL,
  vendedor_id  INT UNSIGNED DEFAULT NULL,
  status       ENUM('novo', 'em_contato', 'convertido', 'descartado') NOT NULL DEFAULT 'novo',
  criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leads_vendedor (vendedor_id),
  KEY idx_leads_status (status),
  CONSTRAINT fk_leads_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- grupos_envio + grupo_clientes: grupos de clientes para e-mails episódicos
-- ----------------------------------------------------------------------------
CREATE TABLE grupos_envio (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(120) NOT NULL,
  descricao   VARCHAR(255) DEFAULT NULL,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grupo_clientes (
  grupo_id   INT UNSIGNED NOT NULL,
  cliente_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (grupo_id, cliente_id),
  KEY idx_grupo_clientes_cliente (cliente_id),
  CONSTRAINT fk_grupo_clientes_grupo FOREIGN KEY (grupo_id) REFERENCES grupos_envio (id) ON DELETE CASCADE,
  CONSTRAINT fk_grupo_clientes_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- campanhas_email: envios de e-mail episódicos para um grupo selecionado
-- ----------------------------------------------------------------------------
CREATE TABLE campanhas_email (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  grupo_id     INT UNSIGNED NOT NULL,
  assunto      VARCHAR(200) NOT NULL,
  corpo        TEXT NOT NULL,
  anexo_url    VARCHAR(255) DEFAULT NULL,
  enviado_por  INT UNSIGNED NOT NULL,
  enviado_em   DATETIME DEFAULT NULL,
  criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campanhas_grupo (grupo_id),
  KEY idx_campanhas_enviado_por (enviado_por),
  CONSTRAINT fk_campanhas_grupo FOREIGN KEY (grupo_id) REFERENCES grupos_envio (id),
  CONSTRAINT fk_campanhas_enviado_por FOREIGN KEY (enviado_por) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
