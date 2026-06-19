export type Cliente = {
  id: number
  razao_social: string
  nome_fantasia: string | null
  cnpj_cpf: string | null
  email: string | null
  email_invalido?: 0 | 1
  telefone: string | null
  whatsapp: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  observacoes: string | null
  condicoes_pagamento: string | null
  categoria_cliente_id: number | null
  categoria_cliente_nome?: string | null
  ativo: 0 | 1
  criado_em: string
}
