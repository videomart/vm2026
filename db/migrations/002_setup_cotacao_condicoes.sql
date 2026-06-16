-- Migração 002: Setup global, cotação do dólar, condições de pagamento
-- e suporte a preço em dólar nos produtos
-- Rodar manualmente: docker exec -i vm2026-db-1 mysql -u vm2026 -ptroque_esta_senha vm2026 < db/migrations/002_setup_cotacao_condicoes.sql

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- setup: configurações globais do sistema (linha única, id=1)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS setup (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_nome            VARCHAR(200) NOT NULL DEFAULT 'Videomart Broadcast',
  empresa_cnpj            VARCHAR(20)  DEFAULT NULL,
  empresa_endereco        VARCHAR(300) DEFAULT NULL,
  empresa_telefone        VARCHAR(20)  DEFAULT NULL,
  empresa_email           VARCHAR(150) DEFAULT NULL,
  empresa_site            VARCHAR(150) DEFAULT NULL,
  -- Fórmula do preço de venda sugerido em R$ para produtos cotados em USD:
  -- preco_venda_sugerido = preco_usd * cotacao_dolar * fator_markup_usd
  -- Ex.: fator_markup_usd = 1.30 → margem de 30% sobre custo em dólar convertido
  fator_markup_usd        DECIMAL(6,4) NOT NULL DEFAULT 1.3000,
  -- Prazo de validade padrão de propostas (dias, 0 = sem padrão)
  proposta_validade_dias  SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  atualizado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Garante que sempre haja uma linha de configuração
INSERT IGNORE INTO setup (id, empresa_nome) VALUES (1, 'Videomart Broadcast Comércio de Equipamentos Ltda');

-- ----------------------------------------------------------------------------
-- cotacao_dolar: histórico diário do dólar
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cotacao_dolar (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  data        DATE NOT NULL,
  valor       DECIMAL(10,4) NOT NULL,
  fonte       VARCHAR(80) DEFAULT NULL,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cotacao_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- condicoes_pagamento: opções reutilizáveis para autocomplete na proposta
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS condicoes_pagamento (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  descricao VARCHAR(200) NOT NULL,
  ativo     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_condicoes_descricao (descricao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opções pré-definidas comuns
INSERT IGNORE INTO condicoes_pagamento (descricao) VALUES
  ('À vista'),
  ('30 dias'),
  ('30/60 dias'),
  ('30/60/90 dias'),
  ('50% na aprovação + 50% na entrega'),
  ('Cartão de crédito em até 12x'),
  ('Boleto bancário 30 dias'),
  ('Transferência bancária à vista');

-- ----------------------------------------------------------------------------
-- Adiciona suporte a preço em dólar na tabela produtos
-- (usa procedure para idempotência, pois MySQL não suporta IF NOT EXISTS no ALTER)
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS _add_col_moeda;
DELIMITER //
CREATE PROCEDURE _add_col_moeda()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'moeda'
  ) THEN
    ALTER TABLE produtos ADD COLUMN moeda ENUM('BRL','USD') NOT NULL DEFAULT 'BRL' AFTER preco_venda;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'preco_usd'
  ) THEN
    ALTER TABLE produtos ADD COLUMN preco_usd DECIMAL(12,4) DEFAULT NULL AFTER moeda;
  END IF;
END //
DELIMITER ;
CALL _add_col_moeda();
DROP PROCEDURE IF EXISTS _add_col_moeda;
