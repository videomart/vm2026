import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { useOverflowHorizontal } from '../../hooks/useOverflowHorizontal'
import { Paginacao } from '../../components/Paginacao'
import { formatarMoeda, formatarData } from '../../utils/formatar'
import { ModalPagamento } from './ModalPagamento'

type StatusConta = 'pendente' | 'parcial' | 'pago' | 'atrasado'

type Conta = {
  id: number
  descricao: string | null
  valor: string
  vencimento: string
  status: StatusConta
  pago_em: string | null
  origem_tipo: 'avulsa' | 'recorrente'
  numero_parcela: number
  total_parcelas: number
  fornecedor_id: number
  fornecedor_nome: string
  categoria_despesa_id: number | null
  categoria_despesa_nome: string | null
  total_pago: string
}

type FornecedorBusca = { id: number; razao_social: string }
type Categoria = { id: number; nome: string }

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

export function ListaContasPagar() {
  const [contas, setContas] = useState<Conta[]>([])
  const [filtroStatus, setFiltroStatus] = useState<StatusConta | ''>('')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [contaModal, setContaModal] = useState<Conta | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const grid = useGrid(contas, 'vencimento')
  const { ref: wrapperRef, temOverflow } = useOverflowHorizontal<HTMLDivElement>()

  // formulário de lançamento avulso
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [fornecedorBusca, setFornecedorBusca] = useState('')
  const [resultadoBusca, setResultadoBusca] = useState<FornecedorBusca[]>([])
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<FornecedorBusca | null>(null)
  const [categoriaId, setCategoriaId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10))
  const [parcelas, setParcelas] = useState('1')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function carregar() {
    setCarregando(true)
    setErro(null)
    const params = new URLSearchParams()
    if (filtroStatus) params.set('status', filtroStatus)
    if (busca.trim()) params.set('q', busca.trim())
    fetch(`/api/contas-pagar?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { setContas(d.contas ?? []); grid.resetar() })
      .catch(() => setErro('Não foi possível carregar as contas a pagar.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => {
    // gera as contas do mês para despesas recorrentes ativas, depois carrega a lista
    fetch('/api/contas-pagar/recorrentes/gerar-mes', { method: 'POST', credentials: 'include' })
      .catch(() => null)
      .finally(carregar)
    fetch('/api/categorias-despesa', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias ?? []))
      .catch(() => null)
  }, [filtroStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fornecedorBusca.trim()) { setResultadoBusca([]); return }
    const timer = setTimeout(async () => {
      const r = await fetch(`/api/fornecedores?q=${encodeURIComponent(fornecedorBusca)}`, { credentials: 'include' })
      const d = await r.json()
      setResultadoBusca((d.fornecedores ?? []).slice(0, 10))
    }, 300)
    return () => clearTimeout(timer)
  }, [fornecedorBusca])

  async function lancar(e: React.FormEvent) {
    e.preventDefault()
    if (!fornecedorSelecionado || !valor || !vencimento) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/contas-pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fornecedor_id: fornecedorSelecionado.id,
          categoria_despesa_id: categoriaId || null,
          descricao: descricao.trim() || null,
          valor: Number(valor),
          vencimento,
          parcelas: Number(parcelas),
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao lançar conta.'); return }
      setMsg(`${parcelas === '1' ? 'Conta lançada' : `${parcelas} parcelas lançadas`} com sucesso.`)
      setFornecedorSelecionado(null)
      setFornecedorBusca('')
      setCategoriaId('')
      setDescricao('')
      setValor('')
      setParcelas('1')
      setMostrarForm(false)
      carregar()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(c: Conta) {
    if (!confirm(`Excluir a conta "${c.descricao ?? c.fornecedor_nome}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/contas-pagar/${c.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) carregar()
  }

  async function reabrir(id: number) {
    if (!confirm('Reabrir esta conta? Os pagamentos registrados serão apagados.')) return
    const res = await fetch(`/api/contas-pagar/${id}/reabrir`, { method: 'PUT', credentials: 'include' })
    if (res.ok) carregar()
  }

  const totalPendente = contas
    .filter((c) => c.status !== 'pago')
    .reduce((s, c) => s + (Number(c.valor) - Number(c.total_pago)), 0)

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Contas a pagar</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link className="botao-secundario" to="/contas-pagar/recorrentes">Despesas recorrentes</Link>
          <button className="botao" type="button" onClick={() => setMostrarForm((m) => !m)}>
            {mostrarForm ? 'Cancelar' : '+ Nova conta'}
          </button>
        </div>
      </div>

      {!carregando && (
        <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>
          Saldo pendente/atrasado: <strong style={{ color: 'var(--text-h)' }}>{formatarMoeda(totalPendente)}</strong>
        </p>
      )}

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {mostrarForm && (
        <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
          <form onSubmit={lancar}>
            <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 1fr 2fr' }}>
              <div className="campo" style={{ position: 'relative' }}>
                <label>Fornecedor *</label>
                <input
                  value={fornecedorSelecionado ? fornecedorSelecionado.razao_social : fornecedorBusca}
                  onChange={(e) => { setFornecedorSelecionado(null); setFornecedorBusca(e.target.value) }}
                  placeholder="Buscar fornecedor..."
                  autoComplete="off"
                />
                {resultadoBusca.length > 0 && !fornecedorSelecionado && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                    {resultadoBusca.map((f) => (
                      <div
                        key={f.id}
                        style={{ padding: '7px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border)' }}
                        onClick={() => { setFornecedorSelecionado(f); setResultadoBusca([]) }}
                      >
                        {f.razao_social}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="campo">
                <label>Categoria</label>
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                  <option value="">—</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="campo">
                <label>Descrição</label>
                <input className="sem-uppercase" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Compra de material" />
              </div>
            </div>
            <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="campo">
                <label>Valor total *</label>
                <input type="number" min="0.01" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
              </div>
              <div className="campo">
                <label>Vencimento (1ª parcela) *</label>
                <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required />
              </div>
              <div className="campo">
                <label>Parcelas</label>
                <input type="number" min="1" max="36" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
                <span style={{ fontSize: '12px', color: 'var(--text)' }}>Divide o valor total em N parcelas mensais.</span>
              </div>
            </div>
            <button className="botao" type="submit" disabled={salvando || !fornecedorSelecionado}>
              {salvando ? 'Salvando...' : 'Lançar conta'}
            </button>
          </form>
        </div>
      )}

      <form className="barra-busca" onSubmit={(e) => { e.preventDefault(); carregar() }}>
        <input
          type="search"
          placeholder="Buscar por fornecedor"
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

      {temOverflow && (
        <p style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '6px' }}>
          ⇆ Role a tabela para o lado para ver todas as colunas e ações.
        </p>
      )}

      <div className="tabela-wrapper" ref={wrapperRef}>
        {carregando && <p className="estado-vazio">Carregando...</p>}
        {!carregando && contas.length === 0 && <p className="estado-vazio">Nenhuma conta a pagar encontrada.</p>}
        {!carregando && contas.length > 0 && (
          <>
            <table className="tabela" style={{ minWidth: '1100px' }}>
              <thead>
                <tr>
                  <th {...grid.th('fornecedor_nome')}>Fornecedor</th>
                  <th {...grid.th('categoria_despesa_nome')}>Categoria</th>
                  <th {...grid.th('descricao')}>Descrição</th>
                  <th {...grid.th('valor')} style={{ whiteSpace: 'nowrap' }}>Valor</th>
                  <th {...grid.th('total_pago')} style={{ whiteSpace: 'nowrap' }}>Pago</th>
                  <th {...grid.th('vencimento')} style={{ whiteSpace: 'nowrap' }}>Vencimento</th>
                  <th {...grid.th('status')} style={{ whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grid.pagina_atual.map((c) => (
                  <tr key={c.id}>
                    <td>{c.fornecedor_nome}</td>
                    <td>{c.categoria_despesa_nome ?? '—'}</td>
                    <td>
                      {c.descricao ?? '—'}
                      {c.total_parcelas > 1 && (
                        <span style={{ fontSize: '0.85em', color: 'var(--text)' }}> ({c.numero_parcela}/{c.total_parcelas})</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarMoeda(c.valor)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarMoeda(c.total_pago)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarData(c.vencimento)}</td>
                    <td><span className={CLASSES_STATUS[c.status]}>{LABELS_STATUS[c.status]}</span></td>
                    <td>
                      <div className="acoes">
                        <button className="botao-link" type="button" onClick={() => setContaModal(c)}>
                          {c.status === 'pago' ? 'Ver' : 'Pagar'}
                        </button>
                        {c.status !== 'pendente' && c.status !== 'atrasado' && (
                          <button className="botao-link" type="button" onClick={() => reabrir(c.id)}>Reabrir</button>
                        )}
                        {c.status === 'pendente' && (
                          <button className="botao-perigo" type="button" onClick={() => excluir(c)}>Excluir</button>
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
        <ModalPagamento
          contaId={contaModal.id}
          valorTotal={Number(contaModal.valor)}
          totalPago={Number(contaModal.total_pago)}
          onFechar={() => setContaModal(null)}
          onAtualizado={carregar}
        />
      )}
    </section>
  )
}
