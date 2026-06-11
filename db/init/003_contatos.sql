-- Tabela de contatos por cliente (multiplos contatos), usada na importacao do vm2025

SET NAMES utf8mb4;

CREATE TABLE contatos (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cliente_id    INT UNSIGNED NOT NULL,
  nome          VARCHAR(100) NOT NULL,
  cargo         VARCHAR(80) DEFAULT NULL,
  telefone      VARCHAR(20) DEFAULT NULL,
  celular       VARCHAR(20) DEFAULT NULL,
  whatsapp      VARCHAR(20) DEFAULT NULL,
  email         VARCHAR(150) DEFAULT NULL,
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contatos_cliente (cliente_id),
  CONSTRAINT fk_contatos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
