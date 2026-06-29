-- Migration 026: entidade "oportunidades" que atravessa lead→proposta→venda, e
-- infraestrutura genérica de gatilhos automáticos de e-mail (substitui o caso
-- especial propostas.ultimo_lembrete_em por uma tabela de auditoria reutilizável
-- pelos novos eventos: lead sem contato, parcela vencendo/vencida, SaaS não gerada).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS oportunidades (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NULL,
  cliente_id INT UNSIGNED NULL,
  vendedor_id INT UNSIGNED NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  status ENUM('prospeccao','proposta_enviada','negociacao','ganha','perdida','pos_venda')
    NOT NULL DEFAULT 'prospeccao',
  venda_id INT UNSIGNED NULL,
  motivo_perda VARCHAR(255) NULL,
  valor_estimado DECIMAL(12,2) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_oportunidades_lead FOREIGN KEY (lead_id) REFERENCES leads(id),
  CONSTRAINT fk_oportunidades_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_oportunidades_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
  CONSTRAINT fk_oportunidades_venda FOREIGN KEY (venda_id) REFERENCES vendas(id),
  INDEX idx_oportunidades_status (status),
  INDEX idx_oportunidades_vendedor (vendedor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gatilhos_enviados (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('lead_sem_contato','proposta_parada','parcela_vencimento','saas_nao_gerada') NOT NULL,
  entidade_id INT UNSIGNED NOT NULL,
  enviado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  destinatarios TEXT NULL,
  INDEX idx_gatilhos_tipo_entidade (tipo, entidade_id),
  INDEX idx_gatilhos_enviado_em (enviado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS _mig026;
DELIMITER //
CREATE PROCEDURE _mig026()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'propostas' AND COLUMN_NAME = 'oportunidade_id') THEN
    ALTER TABLE propostas ADD COLUMN oportunidade_id INT UNSIGNED NULL AFTER vendedor_id;
    ALTER TABLE propostas ADD CONSTRAINT fk_propostas_oportunidade FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'atualizado_em') THEN
    ALTER TABLE leads ADD COLUMN atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER criado_em;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'setup' AND COLUMN_NAME = 'lead_sem_contato_horas') THEN
    ALTER TABLE setup ADD COLUMN lead_sem_contato_horas SMALLINT UNSIGNED NOT NULL DEFAULT 24 AFTER lembrete_proposta_dias;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'setup' AND COLUMN_NAME = 'parcela_vencimento_dias_aviso') THEN
    ALTER TABLE setup ADD COLUMN parcela_vencimento_dias_aviso SMALLINT UNSIGNED NOT NULL DEFAULT 3 AFTER lead_sem_contato_horas;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'setup' AND COLUMN_NAME = 'saas_geracao_dias_aviso') THEN
    ALTER TABLE setup ADD COLUMN saas_geracao_dias_aviso SMALLINT UNSIGNED NOT NULL DEFAULT 5 AFTER parcela_vencimento_dias_aviso;
  END IF;
END //
DELIMITER ;
CALL _mig026();
DROP PROCEDURE IF EXISTS _mig026;

-- Backfill: migra os lembretes de proposta já registrados para a tabela genérica de
-- auditoria, preservando o histórico antes de o motor de gatilhos passar a usá-la.
INSERT INTO gatilhos_enviados (tipo, entidade_id, enviado_em)
SELECT 'proposta_parada', id, ultimo_lembrete_em
FROM propostas
WHERE ultimo_lembrete_em IS NOT NULL
  AND id NOT IN (SELECT entidade_id FROM gatilhos_enviados WHERE tipo = 'proposta_parada');
