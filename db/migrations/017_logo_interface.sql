-- Migration 017: logo separada para a interface (fundo escuro) — a logo_base64
-- existente é usada no PDF de propostas (fundo branco) e não tem contraste
-- adequado quando exibida na sidebar/login (fundo escuro do tema da aplicação).

DROP PROCEDURE IF EXISTS migration_017;
DELIMITER $$
CREATE PROCEDURE migration_017()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'setup' AND column_name = 'logo_interface_base64'
  ) THEN
    ALTER TABLE setup ADD COLUMN logo_interface_base64 MEDIUMTEXT NULL AFTER logo_base64;
  END IF;
END$$
DELIMITER ;
CALL migration_017();
DROP PROCEDURE IF EXISTS migration_017;
