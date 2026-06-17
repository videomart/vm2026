-- Migration 011: e-mails avulsos em grupos de envio (importação via texto/arquivo,
-- sem exigir que o destinatário seja um cliente cadastrado).
CREATE TABLE IF NOT EXISTS grupo_emails_extra (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT UNSIGNED NOT NULL,
  email VARCHAR(150) NOT NULL,
  nome VARCHAR(150) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grupo_email (grupo_id, email),
  CONSTRAINT fk_grupo_emails_extra_grupo FOREIGN KEY (grupo_id) REFERENCES grupos_envio(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
