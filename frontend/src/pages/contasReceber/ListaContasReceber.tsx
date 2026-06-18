import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { Paginacao } from '../../components/Paginacao'
import { formatarMoeda, formatarData } from '../../utils/formatar'

type StatusConta = 'pendente' | 'pago' | 'atrasado'

type Conta = {
  id: number
  descricao: string | null
  valor: string
  vencimento: string
  status: StatusConta
  pago_em: string | null
  venda_id: number
  proposta_id: number
  cliente_id: number
  cliente_nome: string
  vendedor_nome: string
}

const LABELS_STATUS: Record<StatusConta, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
}

const CLASSES_STATUS: Record<StatusConta, string> = {
  pendente: 'badge badge-ativo',
  pago: 'badge badge-sucesso',
  atrasado: 'badge badge-inativo',
}

export function ListaContasReceber() {
  const [contas, setContas] = useState<Conta[]>([])
  const [filtroStatus, setFiltroStatus] = useState<StatusConta | ''>('')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(contas, 'vencimento')

  function carregar() {
    setCarregando(true)
    setErro(null)
    const params = new URLSearchParams()
    if (filtroStatus) params.set('status', filtroStatus)
    if (busca.trim()) params.set('q', busca.trim())
    fetch(`/api/contas-receber?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { setContas(d.contas ?? []); grid.resetar() })
      .catch(() => setErro('Não foi possível carregar as contas a receber.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [filtroStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  async function marcarPago(id: number) {
    const res = await fetch(`/api/contas-receber/${id}/pagar`, { method: 'PUT', credentials: 'include' })
    if (res.ok) carregar()
  }

  async function reabrir(id: number) {
    const res = await fetch(`/api/contas-receber/${id}/reabrir`, { method: 'PUT', credentials: 'include' })
    if (res.ok) carregar()
  }

  const totalPendente = contas
    .filter((c) => c.status !== 'pago')
    .reduce((s, c) => s + Number(c.valor), 0)

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Contas a receber</h2>
      </div>

      {!carregando && (
        <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>
          Total pendente/atrasado: <strong style={{ color: 'var(--text-h)' }}>{formatarMoeda(totalPendente)}</strong>
        </p>
      )}

      <form className="barra-busca" onSubmit={(e) => { e.preventDefault(); carregar() }}>
        <input
          type="search"
          placeholder="Buscar por cliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button className="botao-secundario" type="submit">Buscar</button>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusConta | '')}
          style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--raio)', border: '1px solid var(--border)' }}
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="atrasado">Atrasado</option>
          <option value="pago">Pago</option>
        </select>
      </form>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div className="tabela-wrapper">
        {carregando && <p className="estado-vazio">Carregando...</p>}
        {!carregando && contas.length === 0 && <p className="estado-vazio">Nenhuma conta a receber encontrada.</p>}
        {!carregando && contas.length > 0 && (
          <>
            <table className="tabela" style={{ minWidth: '980px' }}>
              <thead>
                <tr>
                  <th {...grid.th('cliente_nome')}>Cliente</th>
                  <th {...grid.th('descricao')}>Descrição</th>
                  <th {...grid.th('venda_id')} style={{ whiteSpace: 'nowrap' }}>Venda</th>
                  <th {...grid.th('vendedor_nome')}>Vendedor</th>
                  <th {...grid.th('valor')} style={{ whiteSpace: 'nowrap' }}>Valor</th>
                  <th {...grid.th('vencimento')} style={{ whiteSpace: 'nowrap' }}>Vencimento</th>
                  <th {...grid.th('status')} style={{ whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grid.pagina_atual.map((c) => (
                  <tr key={c.id}>
                    <td>{c.cliente_nome}</td>
                    <td>{c.descricao ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link to={`/propostas/${c.proposta_id}`}>#{c.venda_id}</Link>
                    </td>
                    <td>{c.vendedor_nome}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarMoeda(c.valor)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarData(c.vencimento)}</td>
                    <td><span className={CLASSES_STATUS[c.status]}>{LABELS_STATUS[c.status]}</span></td>
                    <td>
                      <div className="acoes">
                        {c.status === 'pago'
                          ? <button className="botao-link" type="button" onClick={() => reabrir(c.id)}>Reabrir</button>
                          : <button className="botao-link" type="button" onClick={() => marcarPago(c.id)}>Marcar pago</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginacao
              pagina={grid.pagina}
              totalPaginas={grid.totalPaginas}
              total={grid.total}
              tamanho={grid.tamanho}
              onIrPara={grid.irPara}
              onMudarTamanho={grid.mudarTamanho}
            />
          </>
        )}
      </div>
    </section>
  )
}
