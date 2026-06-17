-- Migration 007: adiciona coluna logo_base64 na tabela setup
DROP PROCEDURE IF EXISTS migration_007;
DELIMITER $$
CREATE PROCEDURE migration_007()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'setup' AND column_name = 'logo_base64'
  ) THEN
    ALTER TABLE setup ADD COLUMN logo_base64 MEDIUMTEXT NULL;
  END IF;
END$$
DELIMITER ;
CALL migration_007();
DROP PROCEDURE IF EXISTS migration_007;
