import { useEffect, useState } from 'react'
import type { Periodo, ResumoDashboard, StatusLead, StatusProposta } from './types'

const LABELS_PERIODO: Record<Periodo, string> = {
  semana: 'Esta semana',
  mes: 'Este mês',
  ano: 'Este ano',
}

const LABELS_STATUS_PROPOSTA: Record<StatusProposta, string> = {
  aberta: 'Aberta',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  convertida: 'Convertida',
}

const CLASSES_STATUS_PROPOSTA: Record<StatusProposta, string> = {
  aberta: 'badge badge-ativo',
  aprovada: 'badge badge-sucesso',
  recusada: 'badge badge-inativo',
  convertida: 'badge badge-convertida',
}

const LABELS_STATUS_LEAD: Record<StatusLead, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  convertido: 'Convertido',
  descartado: 'Descartado',
}

const CLASSES_STATUS_LEAD: Record<StatusLead, string> = {
  novo: 'badge badge-ativo',
  em_contato: 'badge badge-convertida',
  convertido: 'badge badge-sucesso',
  descartado: 'badge badge-inativo',
}

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function Dashboard() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [resumo, setResumo] = useState<ResumoDashboard | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setCarregando(true)
    setErro(null)
    fetch(`/api/dashboard?periodo=${periodo}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setResumo(d))
      .catch(() => setErro('Não foi possível carregar o resumo.'))
      .finally(() => setCarregando(false))
  }, [periodo])

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Dashboard</h2>
      </div>

      <div className="seletor-periodo">
        {(Object.keys(LABELS_PERIODO) as Periodo[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`botao-secundario ${periodo === p ? 'ativo' : ''}`}
            onClick={() => setPeriodo(p)}
          >
            {LABELS_PERIODO[p]}
          </button>
        ))}
      </div>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {carregando && <p className="estado-vazio">Carregando...</p>}

      {!carregando && resumo && (
        <div className="grade-cartoes">
          <div className="cartao">
            <h3>Propostas</h3>
            <p className="valor-destaque">{resumo.propostas.total}</p>
            <p className="valor-secundario">{formatarValor(resumo.propostas.valor_total)}</p>
            <div className="lista-status">
              {(Object.keys(LABELS_STATUS_PROPOSTA) as StatusProposta[]).map((status) => (
                <span key={status} className={CLASSES_STATUS_PROPOSTA[status]}>
                  {LABELS_STATUS_PROPOSTA[status]}: {resumo.propostas.por_status[status]}
                </span>
              ))}
            </div>
          </div>

          <div className="cartao">
            <h3>Vendas</h3>
            <p className="valor-destaque">{resumo.vendas.total}</p>
            <p className="valor-secundario">{formatarValor(resumo.vendas.valor_total)}</p>
          </div>

          <div className="cartao">
            <h3>Leads</h3>
            <p className="valor-destaque">{resumo.leads.total}</p>
            <div className="lista-status">
              {(Object.keys(LABELS_STATUS_LEAD) as StatusLead[]).map((status) => (
                <span key={status} className={CLASSES_STATUS_LEAD[status]}>
                  {LABELS_STATUS_LEAD[status]}: {resumo.leads.por_status[status]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
