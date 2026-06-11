export type Periodo = 'semana' | 'mes' | 'ano'

export type StatusProposta = 'aberta' | 'aprovada' | 'recusada' | 'convertida'
export type StatusLead = 'novo' | 'em_contato' | 'convertido' | 'descartado'

export type ResumoDashboard = {
  periodo: Periodo
  propostas: {
    total: number
    valor_total: number
    por_status: Record<StatusProposta, number>
  }
  vendas: {
    total: number
    valor_total: number
  }
  leads: {
    total: number
    por_status: Record<StatusLead, number>
  }
}
