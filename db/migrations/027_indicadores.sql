-- Programa de Indicação Premiada
-- Indicadores: profissionais do setor que se cadastram e recebem slug único

CREATE TABLE indicadores (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  empresa       VARCHAR(150) DEFAULT NULL,
  telefone      VARCHAR(30) DEFAULT NULL,
  cpf_cnpj      VARCHAR(20) DEFAULT NULL,
  slug          VARCHAR(80) NOT NULL,
  preferencia_recompensa ENUM('comissao', 'credito') NOT NULL DEFAULT 'comissao',
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_indicadores_email (email),
  UNIQUE KEY uq_indicadores_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coluna de rastreamento de origem em leads
ALTER TABLE leads
  ADD COLUMN indicador_slug VARCHAR(80) DEFAULT NULL AFTER origem,
  ADD KEY idx_leads_indicador (indicador_slug);
