-- Migração 003: tabelas marcas e categorias, populadas a partir de produtos existentes
-- Rodar: docker exec -i vm2026-db-1 mysql -u vm2026 -ptroque_esta_senha vm2026 < db/migrations/003_marcas_categorias.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS marcas (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome      VARCHAR(150) NOT NULL,
  ativo     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marca_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categorias (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome      VARCHAR(150) NOT NULL,
  ativo     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categoria_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Popula com valores já existentes em produtos (idempotente via INSERT IGNORE)
INSERT IGNORE INTO marcas (nome)
  SELECT DISTINCT TRIM(marca) FROM produtos
  WHERE marca IS NOT NULL AND TRIM(marca) != '';

INSERT IGNORE INTO categorias (nome)
  SELECT DISTINCT TRIM(categoria) FROM produtos
  WHERE categoria IS NOT NULL AND TRIM(categoria) != '';
