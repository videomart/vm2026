-- Migration 009: categoria/classe de cliente (tipo: TV, PRODUTORA, UNIVERSIDADE etc.)
-- Referência do legado vm2025: tabela `categoria` (texto livre por cliente).
CREATE TABLE IF NOT EXISTS categorias_cliente (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  ativo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS migration_009;
DELIMITER $$
CREATE PROCEDURE migration_009()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'clientes' AND column_name = 'categoria_cliente_id'
  ) THEN
    ALTER TABLE clientes ADD COLUMN categoria_cliente_id INT UNSIGNED NULL,
      ADD CONSTRAINT fk_clientes_categoria FOREIGN KEY (categoria_cliente_id) REFERENCES categorias_cliente(id);
  END IF;
END$$
DELIMITER ;
CALL migration_009();
DROP PROCEDURE IF EXISTS migration_009;

-- Seed com categorias do legado vm2025
INSERT IGNORE INTO categorias_cliente (nome) VALUES
  ('ASSOCIACAO PRIVADA'), ('BANCO'), ('DEALER'), ('EDITORA'), ('FABRICANTE'),
  ('FUNDACAO'), ('HOSPITAL'), ('IGREJA'), ('IMPORTADORA'), ('INDUSTRIA'),
  ('INFORMATICA'), ('JORNAL'), ('LICITACAO'), ('MANUTENCAO'), ('OUTROS'),
  ('PARTICULAR'), ('PRODUTORA'), ('PROPAGANDA'), ('RADIO'), ('REVENDA'),
  ('SERVICAO'), ('SINDICATO'), ('SONORIZACAO'), ('TELECOMUNICACOES'),
  ('TRANSPORTADORA'), ('TV'), ('UNIVERSIDADE'), ('VENDAS E MANUTENCAO'),
  ('ORGAO PUBLICO'), ('AGENCIA'), ('CURSO/COLEGIO');
