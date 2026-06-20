-- Migration 019: módulo de Contas a Pagar (espelha o de Contas a Receber)
-- Tabelas: fornecedores, categorias_despesa, despesas_recorrentes (~assinaturas),
-- contas_a_pagar (~contas_a_receber), pagamentos (~recebimentos).

CREATE TABLE IF NOT EXISTS fornecedores (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  razao_social VARCHAR(200) NOT NULL,
  nome_fantasia VARCHAR(200) NULL,
  cnpj_cpf VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  telefone VARCHAR(20) NULL,
  observacoes TEXT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fornecedores_razao_social (razao_social)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categorias_despesa (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS despesas_recorrentes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fornecedor_id INT UNSIGNED NOT NULL,
  categoria_despesa_id INT UNSIGNED NULL,
  descricao VARCHAR(200) NOT NULL,
  valor_mensal DECIMAL(12,2) NOT NULL,
  dia_vencimento TINYINT UNSIGNED NOT NULL DEFAULT 10,
  status ENUM('ativa','cancelada') NOT NULL DEFAULT 'ativa',
  data_inicio DATE NOT NULL,
  data_fim DATE NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_despesas_recorrentes_status (status),
  CONSTRAINT fk_despesas_recorrentes_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id),
  CONSTRAINT fk_despesas_recorrentes_categoria FOREIGN KEY (categoria_despesa_id) REFERENCES categorias_despesa(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contas_a_pagar (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fornecedor_id INT UNSIGNED NOT NULL,
  categoria_despesa_id INT UNSIGNED NULL,
  origem_tipo ENUM('avulsa','recorrente') NOT NULL DEFAULT 'avulsa',
  despesa_recorrente_id INT UNSIGNED NULL,
  numero_parcela SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  total_parcelas SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  descricao VARCHAR(200) NULL,
  valor DECIMAL(12,2) NOT NULL,
  vencimento DATE NOT NULL,
  status ENUM('pendente','parcial','pago','atrasado') NOT NULL DEFAULT 'pendente',
  pago_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contas_pagar_status (status),
  INDEX idx_contas_pagar_fornecedor (fornecedor_id),
  CONSTRAINT fk_contas_pagar_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id),
  CONSTRAINT fk_contas_pagar_categoria FOREIGN KEY (categoria_despesa_id) REFERENCES categorias_despesa(id),
  CONSTRAINT fk_contas_pagar_recorrente FOREIGN KEY (despesa_recorrente_id) REFERENCES despesas_recorrentes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pagamentos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conta_id INT UNSIGNED NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_pagamento DATE NOT NULL,
  forma_pagamento VARCHAR(50) NULL,
  observacao VARCHAR(200) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pagamentos_conta FOREIGN KEY (conta_id) REFERENCES contas_a_pagar(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
