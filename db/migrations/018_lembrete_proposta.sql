-- Migration 018: lembrete de proposta parada (sem atividade há N dias)
-- Guarda quando o último lembrete foi enviado para essa proposta, para a
-- rotina de e-mail repetir a cada N dias sem disparar de novo todo dia.

DROP PROCEDURE IF EXISTS migration_018;
DELIMITER $$
CREATE PROCEDURE migration_018()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'propostas' AND column_name = 'ultimo_lembrete_em'
  ) THEN
    ALTER TABLE propostas ADD COLUMN ultimo_lembrete_em DATETIME NULL AFTER atualizado_em;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'setup' AND column_name = 'lembrete_proposta_dias'
  ) THEN
    ALTER TABLE setup ADD COLUMN lembrete_proposta_dias SMALLINT UNSIGNED NOT NULL DEFAULT 3 AFTER envio_lote_pausa_segundos;
  END IF;
END$$
DELIMITER ;
CALL migration_018();
DROP PROCEDURE IF EXISTS migration_018;
