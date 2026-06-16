-- Migração 005: campo corpo em condicoes_pagamento e observacoes_padrao em setup
-- Rodar: docker exec -i vm2026-db-1 mysql -u vm2026 -ptroque_esta_senha vm2026 < db/migrations/005_condicoes_corpo_setup_obs.sql

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS _mig005;
DELIMITER //
CREATE PROCEDURE _mig005()
BEGIN
  -- corpo da condição de pagamento (texto multi-linha para preencher o campo da proposta)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'condicoes_pagamento' AND COLUMN_NAME = 'corpo'
  ) THEN
    ALTER TABLE condicoes_pagamento ADD COLUMN corpo TEXT DEFAULT NULL AFTER descricao;
  END IF;

  -- observações padrão da empresa (preenchidas automaticamente na proposta)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'setup' AND COLUMN_NAME = 'observacoes_padrao'
  ) THEN
    ALTER TABLE setup ADD COLUMN observacoes_padrao TEXT DEFAULT NULL AFTER proposta_validade_dias;
  END IF;
END //
DELIMITER ;
CALL _mig005();
DROP PROCEDURE IF EXISTS _mig005;
