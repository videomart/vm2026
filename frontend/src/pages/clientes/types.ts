export type Cliente = {
  id: number
  razao_social: string
  nome_fantasia: string | null
  cnpj_cpf: string | null
  email: string | null
  telefone: string | null
  whatsapp: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  observacoes: string | null
  ativo: 0 | 1
  criado_em: string
}
