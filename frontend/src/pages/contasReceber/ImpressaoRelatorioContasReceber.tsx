import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatarData } from '../../utils/formatar'

type Periodo = 'semana' | 'mes' | 'ano'
type StatusConta = 'pendente' | 'parcial' | 'pago' | 'atrasado'

type ResumoStatus = { total: number; valor_total: number; valor_recebido: number }

type Conta = {
  id: number
  descricao: string | null
  valor: string
  vencimento: string
  status: StatusConta
  numero_parcela: number
  total_parcelas: number
  cliente_nome: string
  vendedor_nome: string | null
  total_recebido: string
}

type Relatorio = {
  periodo: Periodo
  resumo: Record<StatusConta, ResumoStatus>
  contas: Conta[]
}

type Empresa = { empresa_nome: string; empresa_cnpj: string | null }

const LABELS_PERIODO: Record<Periodo, string> = {
  semana: 'Esta semana',
  mes: 'Este mês',
  ano: 'Este ano',
}

const LABELS_STATUS: Record<StatusConta, string> = {
  pendente: 'Pendente',
  parcial: 'Parcial',
  pago: 'Pago',
  atrasado: 'Atrasado',
}

function fmt(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ImpressaoRelatorioContasReceber() {
  const [params] = useSearchParams()
  const periodo = (params.get('periodo') as Periodo) || 'mes'
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/contas-receber/relatorio?periodo=${periodo}`, { credentials: 'include' }),
      fetch('/api/setup', { credentials: 'include' }),
    ])
      .then(async ([rr, rs]) => {
        if (!rr.ok) return Promise.reject(rr.status)
        const [dr, ds] = await Promise.all([rr.json(), rs.ok ? rs.json() : Promise.resolve(null)])
        setRelatorio(dr)
        if (ds?.setup) setEmpresa(ds.setup)
      })
      .catch(() => setErro('Não foi possível carregar o relatório.'))
  }, [periodo])

  if (erro) return <div className="impressao-erro">{erro}</div>
  if (!relatorio) return <div className="impressao-carregando">Carregando...</div>

  const totalGeral = Object.values(relatorio.resumo).reduce((s, r) => s + r.valor_total, 0)
  const recebidoGeral = Object.values(relatorio.resumo).reduce((s, r) => s + r.valor_recebido, 0)

  return (
    <div className="impressao-pagina">
      <div className="impressao-toolbar">
        <button className="botao" onClick={() => window.print()}>🖨 Imprimir / Salvar PDF</button>
        <button className="botao-secundario" onClick={() => window.close()}>Fechar</button>
      </div>

      <div className="impressao-documento">
        <div className="impressao-cabecalho">
          <div className="impressao-empresa">
            <strong>{empresa?.empresa_nome ?? 'Videomart Broadcast'}</strong>
            {empresa?.empresa_cnpj && <span>CNPJ: {empresa.empresa_cnpj}</span>}
          </div>
          <div className="impressao-titulo-bloco">
            <div className="impressao-titulo">RELATÓRIO — CONTAS A RECEBER</div>
            <table className="impressao-meta">
              <tbody>
                <tr><th>Período</th><td>{LABELS_PERIODO[periodo]}</td></tr>
                <tr><th>Gerado em</th><td>{formatarData(new Date().toISOString())}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <hr className="impressao-divisor" />

        <div className="impressao-totais" style={{ alignItems: 'flex-start' }}>
          <div className="impressao-total-linha"><span>Total no período:</span><span>{fmt(totalGeral)}</span></div>
          <div className="impressao-total-linha"><span>Recebido:</span><span>{fmt(recebidoGeral)}</span></div>
          <div className="impressao-total-linha impressao-total-final"><span>A receber:</span><span>{fmt(totalGeral - recebidoGeral)}</span></div>
        </div>

        <table className="impressao-tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Descrição</th>
              <th>Vendedor</th>
              <th className="col-num">Valor</th>
              <th className="col-num">Recebido</th>
              <th>Vencimento</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {relatorio.contas.map((c) => (
              <tr key={c.id}>
                <td>{c.cliente_nome}</td>
                <td>{c.descricao ?? '—'}{c.total_parcelas > 1 && ` (${c.numero_parcela}/${c.total_parcelas})`}</td>
                <td>{c.vendedor_nome ?? '—'}</td>
                <td className="col-num">{fmt(c.valor)}</td>
                <td className="col-num">{fmt(c.total_recebido)}</td>
                <td>{formatarData(c.vencimento)}</td>
                <td>{LABELS_STATUS[c.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
