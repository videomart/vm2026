import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { useOverflowHorizontal } from '../../hooks/useOverflowHorizontal'
import { Paginacao } from '../../components/Paginacao'
import { formatarMoeda, formatarData } from '../../utils/formatar'
import { mascaraDecimal, desfazerMascaraDecimal } from '../../utils/validacoes'
import { ModalRecebimento } from './ModalRecebimento'

type StatusConta = 'pendente' | 'parcial' | 'pago' | 'atrasado'

type Conta = {
  id: number
  descricao: string | null
  valor: string
  moeda: string
  vencimento: string
  status: StatusConta
  pago_em: string | null
  origem_tipo: 'venda' | 'assinatura' | 'manual'
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

type ClienteBusca = { id: number; razao_social: string }

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

const MOEDAS = ['BRL', 'USD', 'EUR']

export function ListaContasReceber() {
  const [contas, setContas] = useState<Conta[]>([])
  const [filtroStatus, setFiltroStatus] = useState<StatusConta | ''>('')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [contaModal, setContaModal] = useState<Conta | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)

  const grid = useGrid(contas, 'vencimento')
  const { ref: wrapperRef, temOverflow } = useOverflowHorizontal<HTMLDivElement>()

  // formulário de lançamento manual / edição
  const [clienteBusca, setClienteBusca] = useState('')
  const [resultadoBusca, setResultadoBusca] = useState<ClienteBusca[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBusca | null>(null)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [moeda, setMoeda] = useState('BRL')
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

  useEffect(() => {
    if (!clienteBusca.trim()) { setResultadoBusca([]); return }
    const timer = setTimeout(async () => {
      const r = await fetch(`/api/clientes?q=${encodeURIComponent(clienteBusca)}`, { credentials: 'include' })
      const d = await r.json()
      setResultadoBusca((d.clientes ?? []).slice(0, 10))
    }, 300)
    return () => clearTimeout(timer)
  }, [clienteBusca])

  function novoLancamento() {
    setEditandoId(null)
    setClienteSelecionado(null)
    setClienteBusca('')
    setDescricao('')
    setValor('')
    setMoeda('BRL')
    setVencimento(new Date().toISOString().slice(0, 10))
    setParcelas('1')
    setMostrarForm(true)
    setErro(null)
  }

  function editar(c: Conta) {
    setEditandoId(c.id)
    setClienteSelecionado({ id: c.cliente_id, razao_social: c.cliente_nome })
    setClienteBusca('')
    setDescricao(c.descricao ?? '')
    setValor(mascaraDecimal(String(Math.round(Number(c.valor) * 100))))
    setMoeda(c.moeda)
    setVencimento(c.vencimento.slice(0, 10))
    setParcelas('1')
    setMostrarForm(true)
    setErro(null)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const valorNumerico = desfazerMascaraDecimal(valor)
    if (!clienteSelecionado || !valorNumerico || !vencimento) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(editandoId ? `/api/contas-receber/${editandoId}` : '/api/contas-receber', {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cliente_id: clienteSelecionado.id,
          descricao: descricao.trim() || null,
          valor: valorNumerico,
          moeda,
          vencimento,
          parcelas: Number(parcelas),
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar conta.'); return }
      setMsg(editandoId ? 'Conta atualizada.' : (parcelas === '1' ? 'Conta lançada' : `${parcelas} parcelas lançadas`) + ' com sucesso.')
      setMostrarForm(false)
      carregar()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(c: Conta) {
    if (!confirm(`Excluir a conta "${c.descricao ?? c.cliente_nome}"? Esta ação não pode ser desfeita.`)) return
    setErro(null)
    const res = await fetch(`/api/contas-receber/${c.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { carregar(); return }
    const d = await res.json().catch(() => null)
    setErro(d?.erro ?? 'Erro ao excluir conta.')
  }

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
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link className="botao-secundario" to="/contas-receber/assinaturas">Assinaturas recorrentes</Link>
          <button className="botao" type="button" onClick={() => (mostrarForm ? setMostrarForm(false) : novoLancamento())}>
            {mostrarForm ? 'Cancelar' : '+ Novo lançamento'}
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
          <form onSubmit={salvar}>
            <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 2fr' }}>
              <div className="campo" style={{ position: 'relative' }}>
                <label>Cliente *</label>
                <input
                  value={clienteSelecionado ? clienteSelecionado.razao_social : clienteBusca}
                  onChange={(e) => { setClienteSelecionado(null); setClienteBusca(e.target.value) }}
                  placeholder="Buscar cliente..."
                  autoComplete="off"
                />
                {resultadoBusca.length > 0 && !clienteSelecionado && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                    {resultadoBusca.map((c) => (
                      <div
                        key={c.id}
                        style={{ padding: '7px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border)' }}
                        onClick={() => { setClienteSelecionado(c); setResultadoBusca([]) }}
                      >
                        {c.razao_social}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="campo">
                <label>Descrição</label>
                <input className="sem-uppercase" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Recebimento avulso" />
              </div>
            </div>
            <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
              <div className="campo">
                <label>Valor total *</label>
                <input inputMode="numeric" value={valor} onChange={(e) => setValor(mascaraDecimal(e.target.value))} required />
              </div>
              <div className="campo">
                <label>Moeda</label>
                <select value={moeda} onChange={(e) => setMoeda(e.target.value)}>
                  {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="campo">
                <label>Vencimento {!editandoId && '(1ª parcela)'} *</label>
                <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required />
              </div>
              {!editandoId && (
                <div className="campo">
                  <label>Parcelas</label>
                  <input type="number" min="1" max="36" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
                </div>
              )}
            </div>
            <button className="botao" type="submit" disabled={salvando || !clienteSelecionado}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Lançar conta'}
            </button>
          </form>
        </div>
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

      {temOverflow && (
        <p style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '6px' }}>
          ⇆ Role a tabela para o lado para ver todas as colunas e ações.
        </p>
      )}

      <div className="tabela-wrapper" ref={wrapperRef}>
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
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarMoeda(c.valor)} {c.moeda}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarMoeda(c.total_recebido)} {c.moeda}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarData(c.vencimento)}</td>
                    <td><span className={CLASSES_STATUS[c.status]}>{LABELS_STATUS[c.status]}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button className="botao-link" type="button" onClick={() => setContaModal(c)}>
                          {c.status === 'pago' ? 'Ver' : 'Receber'}
                        </button>
                        {c.status !== 'pendente' && c.status !== 'atrasado' && (
                          <button className="botao-link" type="button" onClick={() => reabrir(c.id)}>Reabrir</button>
                        )}
                        {Number(c.total_recebido) === 0 && (
                          <>
                            <button className="botao-link" type="button" onClick={() => editar(c)}>Editar</button>
                            <button className="botao-perigo" type="button" onClick={() => excluir(c)}>Excluir</button>
                          </>
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
          moedaConta={contaModal.moeda}
          onFechar={() => setContaModal(null)}
          onAtualizado={carregar}
        />
      )}
    </section>
  )
}
