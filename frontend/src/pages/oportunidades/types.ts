export type StatusOportunidade =
  | 'prospeccao'
  | 'proposta_enviada'
  | 'negociacao'
  | 'ganha'
  | 'perdida'
  | 'pos_venda'

export type Oportunidade = {
  id: number
  lead_id: number | null
  cliente_id: number | null
  vendedor_id: number
  vendedor_nome: string | null
  cliente_nome: string | null
  titulo: string
  status: StatusOportunidade
  venda_id: number | null
  motivo_perda: string | null
  valor_estimado: string | null
  criado_em: string
  atualizado_em: string
}

export type OportunidadeProposta = {
  id: number
  status: string
  total: string
  criado_em: string
}

export type OportunidadeDetalhe = Oportunidade & {
  lead_nome_empresa: string | null
  lead_contato: string | null
  propostas: OportunidadeProposta[]
}

export type ResumoStatus = {
  status: StatusOportunidade
  total: number
}
