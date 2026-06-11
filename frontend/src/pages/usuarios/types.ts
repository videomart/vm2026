export type Papel = 'admin' | 'vendedor'

export type Usuario = {
  id: number
  nome: string
  email: string
  papel: Papel
  ativo: 0 | 1
  criado_em: string
}
