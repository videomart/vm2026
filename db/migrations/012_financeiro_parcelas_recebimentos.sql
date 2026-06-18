-- Migration 012: parcelamento, recebimentos parciais e assinaturas recorrentes (SaaS)

-- ── Assinaturas recorrentes (cobrança mensal tipo SaaS) ─────────────────────────
CREATE TABLE IF NOT EXISTS assinaturas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT UNSIGNED NOT NULL,
  descricao VARCHAR(200) NOT NULL,
  valor_mensal DECIMAL(12,2) NOT NULL,
  dia_vencimento TINYINT UNSIGNED NOT NULL DEFAULT 10,
  status ENUM('ativa','cancelada') NOT NULL DEFAULT 'ativa',
  data_inicio DATE NOT NULL,
  data_fim DATE NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assinaturas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  INDEX idx_assinaturas_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Ajustes em contas_a_receber: origem genérica (venda OU assinatura) + parcelas ──
DROP PROCEDURE IF EXISTS migration_012;
DELIMITER $$
CREATE PROCEDURE migration_012()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'contas_a_receber' AND column_name = 'origem_tipo'
  ) THEN
    ALTER TABLE contas_a_receber
      ADD COLUMN origem_tipo ENUM('venda','assinatura') NOT NULL DEFAULT 'venda' AFTER venda_id,
      ADD COLUMN assinatura_id INT UNSIGNED NULL AFTER origem_tipo,
      ADD COLUMN numero_parcela SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER assinatura_id,
      ADD COLUMN total_parcelas SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER numero_parcela,
      MODIFY COLUMN venda_id INT UNSIGNED NULL,
      MODIFY COLUMN status ENUM('pendente','parcial','pago','atrasado') NOT NULL DEFAULT 'pendente',
      ADD CONSTRAINT fk_contas_assinatura FOREIGN KEY (assinatura_id) REFERENCES assinaturas(id);
  END IF;
END$$
DELIMITER ;
CALL migration_012();
DROP PROCEDURE IF EXISTS migration_012;

-- ── Recebimentos: lançamentos de pagamento contra uma conta (suporta parcial) ──
CREATE TABLE IF NOT EXISTS recebimentos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conta_id INT UNSIGNED NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_pagamento DATE NOT NULL,
  forma_pagamento VARCHAR(50) NULL,
  observacao VARCHAR(200) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recebimentos_conta FOREIGN KEY (conta_id) REFERENCES contas_a_receber(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
