-- Migration 013: log por destinatário + status de processamento da campanha
-- Resolve: disparos grandes (>100 destinatários) travavam a requisição HTTP até
-- timeout, sem log de quem recebeu com sucesso ou erro, sem progresso visível.

CREATE TABLE IF NOT EXISTS campanha_envios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campanha_id INT UNSIGNED NOT NULL,
  email VARCHAR(150) NOT NULL,
  nome VARCHAR(150) NULL,
  status ENUM('pendente','enviado','erro') NOT NULL DEFAULT 'pendente',
  mensagem_erro VARCHAR(500) NULL,
  enviado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campanha_envios_campanha (campanha_id),
  INDEX idx_campanha_envios_status (status),
  CONSTRAINT fk_campanha_envios_campanha FOREIGN KEY (campanha_id) REFERENCES campanhas_email(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS migration_013;
DELIMITER $$
CREATE PROCEDURE migration_013()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'campanhas_email' AND column_name = 'status_processamento'
  ) THEN
    ALTER TABLE campanhas_email
      ADD COLUMN status_processamento ENUM('processando','concluida','erro') NULL AFTER enviado_em,
      ADD COLUMN total_destinatarios INT UNSIGNED NULL AFTER status_processamento;
  END IF;
END$$
DELIMITER ;
CALL migration_013();
DROP PROCEDURE IF EXISTS migration_013;
