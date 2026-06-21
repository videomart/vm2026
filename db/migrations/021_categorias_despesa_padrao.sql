-- Migration 021: categorias de despesa padrão, comuns a qualquer empresa.
-- INSERT IGNORE: se o usuário já cadastrou uma categoria com o mesmo nome
-- (UNIQUE em categorias_despesa.nome), não duplica nem sobrescreve.

INSERT IGNORE INTO categorias_despesa (nome) VALUES
  ('Aluguel'),
  ('Água'),
  ('Energia elétrica'),
  ('Internet/Telefonia'),
  ('Fornecedores'),
  ('Impostos e taxas'),
  ('Salários e encargos'),
  ('Marketing e publicidade'),
  ('Material de escritório'),
  ('Manutenção e equipamentos'),
  ('Serviços contábeis/jurídicos'),
  ('Transporte e frete'),
  ('Software e assinaturas'),
  ('Outras despesas');
