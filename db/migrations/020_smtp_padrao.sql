-- Migration 020: unifica o SMTP de Configurações (campo único, usado em
-- "esqueci minha senha" e envio individual de proposta) dentro de Contas SMTP
-- — elimina a duplicidade de dois lugares para configurar a mesma coisa.
-- Uma conta marcada como "padrão" passa a ser usada nesses dois fluxos,
-- além de continuar disponível na rotação de campanhas em massa.

DROP PROCEDURE IF EXISTS migration_020;
DELIMITER $$
CREATE PROCEDURE migration_020()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'contas_smtp' AND column_name = 'padrao'
  ) THEN
    ALTER TABLE contas_smtp ADD COLUMN padrao TINYINT(1) NOT NULL DEFAULT 0 AFTER ativo;
  END IF;

  -- Migra a conta única de "setup" (se configurada) para contas_smtp, já
  -- marcada como padrão — preserva o que já estava funcionando, sem exigir
  -- recadastro manual.
  IF EXISTS (
    SELECT 1 FROM setup WHERE id = 1 AND smtp_host IS NOT NULL AND smtp_user IS NOT NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM contas_smtp cs JOIN setup s ON s.id = 1
    WHERE cs.smtp_user = s.smtp_user COLLATE utf8mb4_unicode_ci
  ) THEN
    INSERT INTO contas_smtp (nome, host, port, secure, smtp_user, smtp_pass, smtp_from, limite_dia, ativo, padrao)
    SELECT 'Padrão (migrado de Configurações)', smtp_host, COALESCE(smtp_port, 465),
           COALESCE(smtp_secure, 1), smtp_user, smtp_pass, smtp_from,
           COALESCE(smtp_limite_hora, 100), 1, 1
    FROM setup WHERE id = 1;
  END IF;

  -- Se nenhuma conta está marcada como padrão ainda (instalação nova ou sem
  -- SMTP em setup), marca a primeira conta ativa existente.
  IF NOT EXISTS (SELECT 1 FROM contas_smtp WHERE padrao = 1) THEN
    UPDATE contas_smtp SET padrao = 1 WHERE id = (
      SELECT id FROM contas_smtp WHERE ativo = 1 ORDER BY id ASC LIMIT 1
    );
  END IF;
END$$
DELIMITER ;
CALL migration_020();
DROP PROCEDURE IF EXISTS migration_020;
