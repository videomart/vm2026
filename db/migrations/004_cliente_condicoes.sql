-- Migração 004: campo condicoes_pagamento em clientes
-- Rodar: docker exec -i vm2026-db-1 mysql -u vm2026 -ptroque_esta_senha vm2026 < db/migrations/004_cliente_condicoes.sql

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS _add_col_condicoes_cli;
DELIMITER //
CREATE PROCEDURE _add_col_condicoes_cli()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes' AND COLUMN_NAME = 'condicoes_pagamento'
  ) THEN
    ALTER TABLE clientes ADD COLUMN condicoes_pagamento VARCHAR(200) DEFAULT NULL AFTER observacoes;
  END IF;
END //
DELIMITER ;
CALL _add_col_condicoes_cli();
DROP PROCEDURE IF EXISTS _add_col_condicoes_cli;
