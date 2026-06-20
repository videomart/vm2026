import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatarMoeda, formatarData } from '../../utils/formatar'

type DespesaRecorrente = {
  id: number
  fornecedor_id: number
  fornecedor_nome: string
  categoria_despesa_id: number | null
  categoria_despesa_nome: string | null
  descricao: string
  valor_mensal: string
  dia_vencimento: number
  status: 'ativa' | 'cancelada'
  data_inicio: string
  data_fim: string | null
}

type FornecedorBusca = { id: number; razao_social: string }
type Categoria = { id: number; nome: string }

export function DespesasRecorrentes() {
  const navigate = useNavigate()
  const [lista, setLista] = useState<DespesaRecorrente[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [fornecedorBusca, setFornecedorBusca] = useState('')
  const [resultadoBusca, setResultadoBusca] = useState<FornecedorBusca[]>([])
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<FornecedorBusca | null>(null)
  const [categoriaId, setCategoriaId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorMensal, setValorMensal] = useState('')
  const [diaVencimento, setDiaVencimento] = useState('10')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [salvando, setSalvando] = useState(false)

  function carregar() {
    fetch('/api/contas-pagar/recorrentes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLista(d.recorrentes ?? []))
      .catch(() => setErro('Erro ao carregar despesas recorrentes.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => {
    carregar()
    fetch('/api/categorias-despesa', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias ?? []))
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (!fornecedorBusca.trim()) { setResultadoBusca([]); return }
    const timer = setTimeout(async () => {
      const r = await fetch(`/api/fornecedores?q=${encodeURIComponent(fornecedorBusca)}`, { credentials: 'include' })
      const d = await r.json()
      setResultadoBusca((d.fornecedores ?? []).slice(0, 10))
    }, 300)
    return () => clearTimeout(timer)
  }, [fornecedorBusca])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    if (!fornecedorSelecionado || !descricao.trim() || !valorMensal) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/contas-pagar/recorrentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fornecedor_id: fornecedorSelecionado.id,
          categoria_despesa_id: categoriaId || null,
          descricao: descricao.trim(),
          valor_mensal: Number(valorMensal),
          dia_vencimento: Number(diaVencimento),
          data_inicio: dataInicio,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao criar despesa recorrente.'); return }
      setMsg('Despesa recorrente criada.')
      setFornecedorSelecionado(null)
      setFornecedorBusca('')
      setCategoriaId('')
      setDescricao('')
      setValorMensal('')
      carregar()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function cancelar(id: number) {
    if (!confirm('Cancelar esta despesa recorrente? Nenhuma nova conta mensal será gerada.')) return
    const res = await fetch(`/api/contas-pagar/recorrentes/${id}/cancelar`, { method: 'PUT', credentials: 'include' })
    if (res.ok) carregar()
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Despesas recorrentes</h2>
        <button className="botao-secundario" type="button" onClick={() => navigate('/contas-pagar')}>
          ← Contas a pagar
        </button>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        Despesa mensal automática (aluguel, internet, etc.) — todo mês uma nova conta a pagar
        é gerada para cada despesa recorrente ativa, no dia de vencimento configurado.
      </p>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
        <form onSubmit={criar}>
          <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 1fr 2fr 1fr' }}>
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
              <label>Descrição *</label>
              <input className="sem-uppercase" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Aluguel sala comercial" />
            </div>
            <div className="campo">
              <label>Valor mensal *</label>
              <input type="number" min="0.01" step="0.01" value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} />
            </div>
          </div>
          <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="campo">
              <label>Dia de vencimento (1-28)</label>
              <input type="number" min="1" max="28" value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} />
            </div>
            <div className="campo">
              <label>Início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
          </div>
          <button className="botao" type="submit" disabled={salvando || !fornecedorSelecionado}>
            {salvando ? 'Salvando...' : 'Criar despesa recorrente'}
          </button>
        </form>
      </div>

      <div className="tabela-wrapper">
        {lista.length === 0 && <p className="estado-vazio">Nenhuma despesa recorrente cadastrada.</p>}
        {lista.length > 0 && (
          <table className="tabela">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th>Valor/mês</th>
                <th>Vencimento</th>
                <th>Início</th>
                <th>Status</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.id}>
                  <td>{d.fornecedor_nome}</td>
                  <td>{d.categoria_despesa_nome ?? '—'}</td>
                  <td>{d.descricao}</td>
                  <td>{formatarMoeda(d.valor_mensal)}</td>
                  <td>dia {d.dia_vencimento}</td>
                  <td>{formatarData(d.data_inicio)}</td>
                  <td>
                    {d.status === 'ativa'
                      ? <span className="badge badge-ativo">Ativa</span>
                      : <span className="badge badge-inativo">Cancelada</span>}
                  </td>
                  <td>
                    {d.status === 'ativa' && (
                      <button className="botao-perigo" type="button" onClick={() => cancelar(d.id)}>Cancelar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
