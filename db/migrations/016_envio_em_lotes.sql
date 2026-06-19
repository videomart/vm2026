-- Migration 016: configuração de envio em lotes com pausa (recomendação da
-- Hostinger após bloqueio por ratelimit em campanhas grandes enviadas em
-- sequência contínua) — duas estratégias configuráveis:
--   1. intervalo simples entre cada e-mail (já existia fixo em 10s no código)
--   2. lotes de N e-mails + pausa longa entre lotes (nova)

DROP PROCEDURE IF EXISTS migration_016;
DELIMITER $$
CREATE PROCEDURE migration_016()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'setup' AND column_name = 'envio_intervalo_segundos'
  ) THEN
    ALTER TABLE setup
      ADD COLUMN envio_intervalo_segundos SMALLINT UNSIGNED NOT NULL DEFAULT 10 AFTER smtp_limite_hora,
      ADD COLUMN envio_lote_tamanho SMALLINT UNSIGNED NOT NULL DEFAULT 25 AFTER envio_intervalo_segundos,
      ADD COLUMN envio_lote_pausa_segundos SMALLINT UNSIGNED NOT NULL DEFAULT 300 AFTER envio_lote_tamanho;
  END IF;
END$$
DELIMITER ;
CALL migration_016();
DROP PROCEDURE IF EXISTS migration_016;
