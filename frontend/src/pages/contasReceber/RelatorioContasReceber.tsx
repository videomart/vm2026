import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatarMoeda, formatarData } from '../../utils/formatar'

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

const CLASSES_STATUS: Record<StatusConta, string> = {
  pendente: 'badge badge-ativo',
  parcial: 'badge badge-ativo',
  pago: 'badge badge-sucesso',
  atrasado: 'badge badge-inativo',
}

export function RelatorioContasReceber() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setCarregando(true)
    setErro(null)
    fetch(`/api/contas-receber/relatorio?periodo=${periodo}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setRelatorio(d))
      .catch(() => setErro('Não foi possível carregar o relatório.'))
      .finally(() => setCarregando(false))
  }, [periodo])

  const totalGeral = relatorio
    ? Object.values(relatorio.resumo).reduce((s, r) => s + r.valor_total, 0)
    : 0
  const recebidoGeral = relatorio
    ? Object.values(relatorio.resumo).reduce((s, r) => s + r.valor_recebido, 0)
    : 0

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Relatório — Contas a receber</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link className="botao-secundario" to="/contas-receber">← Contas a receber</Link>
          {relatorio && (
            <Link className="botao" to={`/contas-receber/relatorio/imprimir?periodo=${periodo}`} target="_blank">
              🖨 Imprimir
            </Link>
          )}
        </div>
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

      {!carregando && relatorio && (
        <>
          <div className="grade-cartoes" style={{ marginBottom: '24px' }}>
            <div className="cartao">
              <h3>Total no período</h3>
              <p className="valor-destaque">{formatarMoeda(totalGeral)}</p>
              <p className="valor-secundario">{relatorio.contas.length} conta(s)</p>
            </div>
            <div className="cartao">
              <h3>Recebido</h3>
              <p className="valor-destaque" style={{ color: 'var(--sucesso)' }}>{formatarMoeda(recebidoGeral)}</p>
            </div>
            <div className="cartao">
              <h3>A receber</h3>
              <p className="valor-destaque" style={{ color: 'var(--perigo)' }}>{formatarMoeda(totalGeral - recebidoGeral)}</p>
            </div>
            {(Object.keys(LABELS_STATUS) as StatusConta[]).map((status) => (
              <div className="cartao" key={status}>
                <h3>{LABELS_STATUS[status]}</h3>
                <p className="valor-destaque">{relatorio.resumo[status].total}</p>
                <p className="valor-secundario">{formatarMoeda(relatorio.resumo[status].valor_total)}</p>
              </div>
            ))}
          </div>

          <div className="tabela-wrapper">
            {relatorio.contas.length === 0 && <p className="estado-vazio">Nenhuma conta no período.</p>}
            {relatorio.contas.length > 0 && (
              <table className="tabela" style={{ minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Descrição</th>
                    <th>Vendedor</th>
                    <th>Valor</th>
                    <th>Recebido</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.contas.map((c) => (
                    <tr key={c.id}>
                      <td>{c.cliente_nome}</td>
                      <td>
                        {c.descricao ?? '—'}
                        {c.total_parcelas > 1 && (
                          <span style={{ fontSize: '0.85em', color: 'var(--text)' }}> ({c.numero_parcela}/{c.total_parcelas})</span>
                        )}
                      </td>
                      <td>{c.vendedor_nome ?? '—'}</td>
                      <td>{formatarMoeda(c.valor)}</td>
                      <td>{formatarMoeda(c.total_recebido)}</td>
                      <td>{formatarData(c.vencimento)}</td>
                      <td><span className={CLASSES_STATUS[c.status]}>{LABELS_STATUS[c.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  )
}
