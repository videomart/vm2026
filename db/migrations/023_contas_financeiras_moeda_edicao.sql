-- Migration 023: contas financeiras (conciliação de caixa/banco), moeda no
-- lançamento, lançamento manual de contas a receber (sem venda associada) e
-- vínculo opcional cliente <-> fornecedor.

-- ── Contas financeiras: destino real do dinheiro (caixa, banco, cartão) ───────
CREATE TABLE IF NOT EXISTS contas_financeiras (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  tipo ENUM('caixa','banco','cartao') NOT NULL DEFAULT 'banco',
  saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contas_financeiras_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO contas_financeiras (nome, tipo)
SELECT 'Caixa (dinheiro)', 'caixa' FROM (SELECT 1) x
WHERE NOT EXISTS (SELECT 1 FROM contas_financeiras);

-- ── Migra forma_pagamento (texto livre) para conta_financeira_id ───────────────
DROP PROCEDURE IF EXISTS migration_023;
DELIMITER $$
CREATE PROCEDURE migration_023()
BEGIN
  -- recebimentos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'recebimentos' AND column_name = 'conta_financeira_id'
  ) THEN
    ALTER TABLE recebimentos
      ADD COLUMN conta_financeira_id INT UNSIGNED NULL AFTER forma_pagamento,
      ADD COLUMN moeda CHAR(3) NOT NULL DEFAULT 'BRL' AFTER valor,
      ADD COLUMN cotacao DECIMAL(10,4) NULL AFTER moeda,
      ADD CONSTRAINT fk_recebimentos_conta_financeira FOREIGN KEY (conta_financeira_id) REFERENCES contas_financeiras(id);
  END IF;

  -- pagamentos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'pagamentos' AND column_name = 'conta_financeira_id'
  ) THEN
    ALTER TABLE pagamentos
      ADD COLUMN conta_financeira_id INT UNSIGNED NULL AFTER forma_pagamento,
      ADD COLUMN moeda CHAR(3) NOT NULL DEFAULT 'BRL' AFTER valor,
      ADD COLUMN cotacao DECIMAL(10,4) NULL AFTER moeda,
      ADD CONSTRAINT fk_pagamentos_conta_financeira FOREIGN KEY (conta_financeira_id) REFERENCES contas_financeiras(id);
  END IF;

  -- contas_a_receber: moeda do lançamento + permitir lançamento manual (sem venda/assinatura)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'contas_a_receber' AND column_name = 'moeda'
  ) THEN
    ALTER TABLE contas_a_receber
      ADD COLUMN moeda CHAR(3) NOT NULL DEFAULT 'BRL' AFTER valor,
      ADD COLUMN cliente_id INT UNSIGNED NULL AFTER moeda,
      MODIFY COLUMN origem_tipo ENUM('venda','assinatura','manual') NOT NULL DEFAULT 'venda',
      ADD CONSTRAINT fk_contas_receber_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id);
  END IF;

  -- contas_a_pagar: moeda do lançamento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'contas_a_pagar' AND column_name = 'moeda'
  ) THEN
    ALTER TABLE contas_a_pagar
      ADD COLUMN moeda CHAR(3) NOT NULL DEFAULT 'BRL' AFTER valor;
  END IF;

  -- fornecedores: vínculo opcional com um cliente já cadastrado (mesma empresa atua nos dois papéis)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'fornecedores' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE fornecedores
      ADD COLUMN cliente_id INT UNSIGNED NULL AFTER cnpj_cpf,
      ADD CONSTRAINT fk_fornecedores_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id);
  END IF;
END$$
DELIMITER ;
CALL migration_023();
DROP PROCEDURE IF EXISTS migration_023;

-- preenche cliente_id das contas a receber já existentes (origem venda/assinatura)
UPDATE contas_a_receber cr
LEFT JOIN vendas v ON v.id = cr.venda_id
LEFT JOIN assinaturas a ON a.id = cr.assinatura_id
SET cr.cliente_id = COALESCE(v.cliente_id, a.cliente_id)
WHERE cr.cliente_id IS NULL;
