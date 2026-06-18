import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { Paginacao } from '../../components/Paginacao'
import { formatarMoeda, formatarData } from '../../utils/formatar'
import { ModalRecebimento } from './ModalRecebimento'

type StatusConta = 'pendente' | 'parcial' | 'pago' | 'atrasado'

type Conta = {
  id: number
  descricao: string | null
  valor: string
  vencimento: string
  status: StatusConta
  pago_em: string | null
  origem_tipo: 'venda' | 'assinatura'
  numero_parcela: number
  total_parcelas: number
  venda_id: number | null
  proposta_id: number | null
  assinatura_id: number | null
  cliente_id: number
  cliente_nome: string
  vendedor_nome: string | null
  total_recebido: string
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

export function ListaContasReceber() {
  const [contas, setContas] = useState<Conta[]>([])
  const [filtroStatus, setFiltroStatus] = useState<StatusConta | ''>('')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [contaModal, setContaModal] = useState<Conta | null>(null)

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

  useEffect(() => {
    // gera as contas do mês para assinaturas ativas, depois carrega a lista
    fetch('/api/contas-receber/assinaturas/gerar-mes', { method: 'POST', credentials: 'include' })
      .catch(() => null)
      .finally(carregar)
  }, [filtroStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  async function reabrir(id: number) {
    if (!confirm('Reabrir esta conta? Os recebimentos registrados serão apagados.')) return
    const res = await fetch(`/api/contas-receber/${id}/reabrir`, { method: 'PUT', credentials: 'include' })
    if (res.ok) carregar()
  }

  const totalPendente = contas
    .filter((c) => c.status !== 'pago')
    .reduce((s, c) => s + (Number(c.valor) - Number(c.total_recebido)), 0)

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Contas a receber</h2>
        <Link className="botao-secundario" to="/contas-receber/assinaturas">Assinaturas recorrentes</Link>
      </div>

      {!carregando && (
        <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>
          Saldo pendente/atrasado: <strong style={{ color: 'var(--text-h)' }}>{formatarMoeda(totalPendente)}</strong>
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
          <option value="parcial">Parcial</option>
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
            <table className="tabela" style={{ minWidth: '1100px' }}>
              <thead>
                <tr>
                  <th {...grid.th('cliente_nome')}>Cliente</th>
                  <th {...grid.th('descricao')}>Descrição</th>
                  <th {...grid.th('vendedor_nome')}>Vendedor</th>
                  <th {...grid.th('valor')} style={{ whiteSpace: 'nowrap' }}>Valor</th>
                  <th {...grid.th('total_recebido')} style={{ whiteSpace: 'nowrap' }}>Recebido</th>
                  <th {...grid.th('vencimento')} style={{ whiteSpace: 'nowrap' }}>Vencimento</th>
                  <th {...grid.th('status')} style={{ whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grid.pagina_atual.map((c) => (
                  <tr key={c.id}>
                    <td>{c.cliente_nome}</td>
                    <td>
                      {c.descricao ?? '—'}
                      {c.origem_tipo === 'venda' && c.proposta_id && (
                        <> · <Link to={`/propostas/${c.proposta_id}`}>proposta #{c.proposta_id}</Link></>
                      )}
                    </td>
                    <td>{c.vendedor_nome ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarMoeda(c.valor)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarMoeda(c.total_recebido)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarData(c.vencimento)}</td>
                    <td><span className={CLASSES_STATUS[c.status]}>{LABELS_STATUS[c.status]}</span></td>
                    <td>
                      <div className="acoes">
                        <button className="botao-link" type="button" onClick={() => setContaModal(c)}>
                          {c.status === 'pago' ? 'Ver' : 'Receber'}
                        </button>
                        {c.status !== 'pendente' && c.status !== 'atrasado' && (
                          <button className="botao-link" type="button" onClick={() => reabrir(c.id)}>Reabrir</button>
                        )}
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

      {contaModal && (
        <ModalRecebimento
          contaId={contaModal.id}
          valorTotal={Number(contaModal.valor)}
          totalRecebido={Number(contaModal.total_recebido)}
          onFechar={() => setContaModal(null)}
          onAtualizado={carregar}
        />
      )}
    </section>
  )
}
