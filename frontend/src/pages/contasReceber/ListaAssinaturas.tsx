import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatarMoeda, formatarData } from '../../utils/formatar'

type Assinatura = {
  id: number
  cliente_id: number
  cliente_nome: string
  descricao: string
  valor_mensal: string
  dia_vencimento: number
  status: 'ativa' | 'cancelada'
  data_inicio: string
  data_fim: string | null
}

type ClienteBusca = { id: number; razao_social: string }

export function ListaAssinaturas() {
  const navigate = useNavigate()
  const [lista, setLista] = useState<Assinatura[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [clienteBusca, setClienteBusca] = useState('')
  const [resultadoBusca, setResultadoBusca] = useState<ClienteBusca[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBusca | null>(null)
  const [descricao, setDescricao] = useState('')
  const [valorMensal, setValorMensal] = useState('')
  const [diaVencimento, setDiaVencimento] = useState('10')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [salvando, setSalvando] = useState(false)

  function carregar() {
    fetch('/api/contas-receber/assinaturas', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLista(d.assinaturas ?? []))
      .catch(() => setErro('Erro ao carregar assinaturas.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    if (!clienteBusca.trim()) { setResultadoBusca([]); return }
    const timer = setTimeout(async () => {
      const r = await fetch(`/api/clientes?q=${encodeURIComponent(clienteBusca)}`, { credentials: 'include' })
      const d = await r.json()
      setResultadoBusca((d.clientes ?? []).slice(0, 10))
    }, 300)
    return () => clearTimeout(timer)
  }, [clienteBusca])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteSelecionado || !descricao.trim() || !valorMensal) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/contas-receber/assinaturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cliente_id: clienteSelecionado.id,
          descricao: descricao.trim(),
          valor_mensal: Number(valorMensal),
          dia_vencimento: Number(diaVencimento),
          data_inicio: dataInicio,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao criar assinatura.'); return }
      setMsg('Assinatura criada.')
      setClienteSelecionado(null)
      setClienteBusca('')
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
    if (!confirm('Cancelar esta assinatura? Nenhuma nova cobrança mensal será gerada.')) return
    const res = await fetch(`/api/contas-receber/assinaturas/${id}/cancelar`, { method: 'PUT', credentials: 'include' })
    if (res.ok) carregar()
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Assinaturas recorrentes</h2>
        <button className="botao-secundario" type="button" onClick={() => navigate('/contas-receber')}>
          ← Contas a receber
        </button>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        Cobrança mensal automática (tipo SaaS) — todo mês uma nova conta a receber é gerada
        para cada assinatura ativa, no dia de vencimento configurado.
      </p>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
        <form onSubmit={criar}>
          <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 2fr 1fr' }}>
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
              <label>Descrição *</label>
              <input className="sem-uppercase" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: TVPlay — plano mensal" />
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
          <button className="botao" type="submit" disabled={salvando || !clienteSelecionado}>
            {salvando ? 'Salvando...' : 'Criar assinatura'}
          </button>
        </form>
      </div>

      <div className="tabela-wrapper">
        {lista.length === 0 && <p className="estado-vazio">Nenhuma assinatura cadastrada.</p>}
        {lista.length > 0 && (
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Descrição</th>
                <th>Valor/mês</th>
                <th>Vencimento</th>
                <th>Início</th>
                <th>Status</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/clientes/${a.cliente_id}/editar`}>{a.cliente_nome}</Link></td>
                  <td>{a.descricao}</td>
                  <td>{formatarMoeda(a.valor_mensal)}</td>
                  <td>dia {a.dia_vencimento}</td>
                  <td>{formatarData(a.data_inicio)}</td>
                  <td>
                    {a.status === 'ativa'
                      ? <span className="badge badge-ativo">Ativa</span>
                      : <span className="badge badge-inativo">Cancelada</span>}
                  </td>
                  <td>
                    {a.status === 'ativa' && (
                      <button className="botao-perigo" type="button" onClick={() => cancelar(a.id)}>Cancelar</button>
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
