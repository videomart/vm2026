-- Migration 024: corrige collation da coluna `moeda` em contas_a_pagar/pagamentos/
-- recebimentos, que ficou em utf8mb4_0900_ai_ci (padrão do servidor MySQL 8) em vez
-- de utf8mb4_unicode_ci (usado pelo resto do schema, incl. contas_a_receber.moeda).
-- A divergência quebra qualquer JOIN/comparação entre essas colunas com erro 1267
-- "Illegal mix of collations".

ALTER TABLE contas_a_pagar MODIFY COLUMN moeda CHAR(3) NOT NULL DEFAULT 'BRL' COLLATE utf8mb4_unicode_ci;
ALTER TABLE pagamentos MODIFY COLUMN moeda CHAR(3) NOT NULL DEFAULT 'BRL' COLLATE utf8mb4_unicode_ci;
ALTER TABLE recebimentos MODIFY COLUMN moeda CHAR(3) NOT NULL DEFAULT 'BRL' COLLATE utf8mb4_unicode_ci;
