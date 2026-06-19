-- Migration 015: marca e-mails inválidos detectados em campanhas (sanitização)
-- Resolve: e-mails com erro definitivo de envio (endereço inexistente/rejeitado)
-- continuavam cadastrados, sendo reenviados em toda campanha futura sem nunca
-- entregar. "Sanitizar" esvazia o campo email (não tenta mais enviar) e marca
-- email_invalido=1, permitindo listar quem precisa ter o e-mail recadastrado.

DROP PROCEDURE IF EXISTS migration_015;
DELIMITER $$
CREATE PROCEDURE migration_015()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'clientes' AND column_name = 'email_invalido'
  ) THEN
    ALTER TABLE clientes ADD COLUMN email_invalido TINYINT(1) NOT NULL DEFAULT 0 AFTER email;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'contatos' AND column_name = 'email_invalido'
  ) THEN
    ALTER TABLE contatos ADD COLUMN email_invalido TINYINT(1) NOT NULL DEFAULT 0 AFTER email;
  END IF;
END$$
DELIMITER ;
CALL migration_015();
DROP PROCEDURE IF EXISTS migration_015;
