-- Migration 008: condicoes_pagamento de VARCHAR(200) para TEXT
-- (texto padrão de condições de pagamento excede 200 caracteres)
ALTER TABLE propostas MODIFY COLUMN condicoes_pagamento TEXT NULL;
ALTER TABLE clientes MODIFY COLUMN condicoes_pagamento TEXT NULL;
