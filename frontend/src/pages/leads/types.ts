export type StatusLead = 'novo' | 'em_contato' | 'convertido' | 'descartado'

export type Lead = {
  id: number
  nome_empresa: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
  uf: string | null
  assunto: string | null
  mensagem: string | null
  origem: string | null
  vendedor_id: number | null
  vendedor_nome: string | null
  status: StatusLead
  criado_em: string
}
