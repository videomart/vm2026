export type Produto = {
  id: number
  modelo: string
  descricao: string | null
  marca: string | null
  categoria: string | null
  preco_custo: string | null
  preco_venda: string | null
  moeda: 'BRL' | 'USD' | null
  preco_usd: string | null
  preco_sugerido?: number | null
  peso: string | null
  ativo: number
}
