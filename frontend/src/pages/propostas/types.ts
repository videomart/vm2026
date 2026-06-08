export type StatusProposta = 'aberta' | 'aprovada' | 'recusada' | 'convertida'

export type PropostaItem = {
  id: number
  proposta_id: number
  produto_id: number | null
  produto_modelo: string | null
  descricao: string
  quantidade: string
  valor_unitario: string
  desconto: string
  subtotal: string
}

export type Proposta = {
  id: number
  cliente_id: number
  vendedor_id: number
  cliente_nome: string
  vendedor_nome: string
  data: string
  validade: string | null
  condicoes_pagamento: string | null
  observacoes: string | null
  status: StatusProposta
  total: string
  desconto: string
  itens?: PropostaItem[]
}

export type ItemFormulario = {
  produto_id: number | null
  descricao: string
  quantidade: string
  valor_unitario: string
  desconto: string
}
