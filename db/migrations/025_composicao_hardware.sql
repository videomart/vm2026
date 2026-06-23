-- Migration 025: composição de hardware para produtos ofertados como solução
-- integrada (turnkey). `composicoes_hardware` é um catálogo de templates prontos
-- (texto livre, 1 item por linha) que só serve para inicializar o campo do produto
-- ao ser selecionado — depois de copiado, o texto no produto é livremente editável
-- e não fica vinculado ao template de origem.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS composicoes_hardware (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  itens TEXT NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS _mig025;
DELIMITER //
CREATE PROCEDURE _mig025()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'tipo_oferta') THEN
    ALTER TABLE produtos ADD COLUMN tipo_oferta ENUM('turnkey', 'software_venda', 'saas') NOT NULL DEFAULT 'software_venda' AFTER categoria;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produtos' AND COLUMN_NAME = 'composicao_hardware') THEN
    ALTER TABLE produtos ADD COLUMN composicao_hardware TEXT NULL AFTER tipo_oferta;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'proposta_itens' AND COLUMN_NAME = 'composicao_hardware') THEN
    ALTER TABLE proposta_itens ADD COLUMN composicao_hardware TEXT NULL AFTER descricao;
  END IF;
END //
DELIMITER ;
CALL _mig025();
DROP PROCEDURE IF EXISTS _mig025;
