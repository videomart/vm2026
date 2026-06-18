-- Migration 014: múltiplas contas SMTP com rotação e limite diário
-- (Hostinger limita 100 e-mails/dia por caixa postal — para enviar mais,
-- distribui-se entre N contas em round-robin)

CREATE TABLE IF NOT EXISTS contas_smtp (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  host VARCHAR(150) NOT NULL,
  port SMALLINT UNSIGNED NOT NULL DEFAULT 465,
  secure TINYINT(1) NOT NULL DEFAULT 1,
  smtp_user VARCHAR(150) NOT NULL,
  smtp_pass VARCHAR(150) NOT NULL,
  smtp_from VARCHAR(200) NULL,
  reply_to VARCHAR(200) NULL,
  limite_dia SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contas_smtp_user (smtp_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contagem de envios por conta/dia, para respeitar o limite diário de cada caixa
CREATE TABLE IF NOT EXISTS contas_smtp_uso (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conta_id INT UNSIGNED NOT NULL,
  data DATE NOT NULL,
  total_enviado INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_conta_data (conta_id, data),
  CONSTRAINT fk_contas_smtp_uso_conta FOREIGN KEY (conta_id) REFERENCES contas_smtp(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Registra qual conta enviou cada e-mail da campanha (auditoria/depuração)
DROP PROCEDURE IF EXISTS migration_014;
DELIMITER $$
CREATE PROCEDURE migration_014()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'campanha_envios' AND column_name = 'conta_smtp_id'
  ) THEN
    ALTER TABLE campanha_envios
      ADD COLUMN conta_smtp_id INT UNSIGNED NULL AFTER status,
      ADD CONSTRAINT fk_campanha_envios_conta_smtp FOREIGN KEY (conta_smtp_id) REFERENCES contas_smtp(id);
  END IF;
END$$
DELIMITER ;
CALL migration_014();
DROP PROCEDURE IF EXISTS migration_014;
