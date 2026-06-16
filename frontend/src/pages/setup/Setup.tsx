import { useEffect, useState } from 'react'

type SetupData = {
  empresa_nome: string
  empresa_cnpj: string
  empresa_endereco: string
  empresa_telefone: string
  empresa_email: string
  empresa_site: string
  fator_markup_usd: string
  proposta_validade_dias: string
  observacoes_padrao: string
}

type Condicao = { id: number; descricao: string; corpo: string | null }
type Cotacao = { id: number; data: string; valor: string; fonte: string | null } | null

const SETUP_VAZIO: SetupData = {
  empresa_nome: '',
  empresa_cnpj: '',
  empresa_endereco: '',
  empresa_telefone: '',
  empresa_email: '',
  empresa_site: '',
  fator_markup_usd: '1.3',
  proposta_validade_dias: '30',
  observacoes_padrao: '',
}

function paraForm(s: any): SetupData {
  return {
    empresa_nome: s.empresa_nome ?? '',
    empresa_cnpj: s.empresa_cnpj ?? '',
    empresa_endereco: s.empresa_endereco ?? '',
    empresa_telefone: s.empresa_telefone ?? '',
    empresa_email: s.empresa_email ?? '',
    empresa_site: s.empresa_site ?? '',
    fator_markup_usd: String(s.fator_markup_usd ?? '1.3'),
    proposta_validade_dias: String(s.proposta_validade_dias ?? '30'),
    observacoes_padrao: s.observacoes_padrao ?? '',
  }
}

const H3: React.CSSProperties = { marginBottom: '12px', marginTop: '28px', fontSize: '15px', color: 'var(--text-h)', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }

export function Setup() {
  const [campos, setCampos] = useState<SetupData>(SETUP_VAZIO)
  const [condicoes, setCondicoes] = useState<Condicao[]>([])
  const [cotacao, setCotacao] = useState<Cotacao>(null)
  const [novaNome, setNovaNome] = useState('')
  const [novaCorpo, setNovaCorpo] = useState('')
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [novaCotacaoData, setNovaCotacaoData] = useState(new Date().toISOString().slice(0, 10))
  const [novaCotacaoValor, setNovaCotacaoValor] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    try {
      const [rs, rc, rco] = await Promise.all([
        fetch('/api/setup', { credentials: 'include' }),
        fetch('/api/setup/condicoes', { credentials: 'include' }),
        fetch('/api/setup/cotacao', { credentials: 'include' }),
      ])
      const [ds, dc, dco] = await Promise.all([rs.json(), rc.json(), rco.json()])
      if (ds.setup) setCampos(paraForm(ds.setup))
      setCondicoes(dc.condicoes ?? [])
      setCotacao(dco.cotacao ?? null)
    } catch {
      setErro('Erro ao carregar configurações.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function atualizar(campo: keyof SetupData, valor: string) {
    setCampos((c) => ({ ...c, [campo]: valor }))
  }

  async function salvarSetup(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)
    setErro(null)
    try {
      const res = await fetch('/api/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...campos,
          fator_markup_usd: Number(campos.fator_markup_usd),
          proposta_validade_dias: Number(campos.proposta_validade_dias),
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar.'); return }
      setMsg('Configurações salvas.')
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarCondicao() {
    if (!novaNome.trim()) return
    const isEdicao = editandoId !== null
    const url = isEdicao ? `/api/setup/condicoes/${editandoId}` : '/api/setup/condicoes'
    const method = isEdicao ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao: novaNome.trim(), corpo: novaCorpo.trim() || null }),
    })
    const d = await res.json()
    if (res.ok) {
      if (isEdicao) {
        setCondicoes((prev) =>
          prev.map((c) => c.id === editandoId ? { ...c, descricao: novaNome.trim(), corpo: novaCorpo.trim() || null } : c)
        )
      } else {
        setCondicoes((prev) => [...prev, d.condicao].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')))
      }
      setNovaNome('')
      setNovaCorpo('')
      setEditandoId(null)
    } else {
      setErro(d.erro ?? 'Erro ao salvar condição.')
    }
  }

  function editarCondicao(c: Condicao) {
    setEditandoId(c.id)
    setNovaNome(c.descricao)
    setNovaCorpo(c.corpo ?? '')
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setNovaNome('')
    setNovaCorpo('')
  }

  async function removerCondicao(id: number) {
    if (!confirm('Remover esta condição?')) return
    await fetch(`/api/setup/condicoes/${id}`, { method: 'DELETE', credentials: 'include' })
    setCondicoes((c) => c.filter((x) => x.id !== id))
    if (editandoId === id) cancelarEdicao()
  }

  async function salvarCotacao(e: React.FormEvent) {
    e.preventDefault()
    if (!novaCotacaoValor) return
    const res = await fetch('/api/setup/cotacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ data: novaCotacaoData, valor: novaCotacaoValor, fonte: 'manual' }),
    })
    const d = await res.json()
    if (res.ok) {
      setCotacao(d.cotacao)
      setMsg('Cotação salva.')
    } else {
      setErro(d.erro ?? 'Erro ao salvar cotação.')
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Configurações do sistema</h2>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {/* ── Dados da empresa ── */}
      <form onSubmit={salvarSetup}>
        <h3 style={H3}>Dados da empresa</h3>
        <div className="grade-formulario">
          <div className="campo campo-largo">
            <label>Razão social</label>
            <input value={campos.empresa_nome} onChange={(e) => atualizar('empresa_nome', e.target.value)} required />
          </div>
          <div className="campo">
            <label>CNPJ</label>
            <input value={campos.empresa_cnpj} onChange={(e) => atualizar('empresa_cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className="campo campo-largo">
            <label>Endereço</label>
            <input value={campos.empresa_endereco} onChange={(e) => atualizar('empresa_endereco', e.target.value)} />
          </div>
          <div className="campo">
            <label>Telefone</label>
            <input value={campos.empresa_telefone} onChange={(e) => atualizar('empresa_telefone', e.target.value)} />
          </div>
          <div className="campo">
            <label>E-mail</label>
            <input type="email" value={campos.empresa_email} onChange={(e) => atualizar('empresa_email', e.target.value)} />
          </div>
          <div className="campo">
            <label>Site</label>
            <input className="sem-uppercase" value={campos.empresa_site} onChange={(e) => atualizar('empresa_site', e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <h3 style={H3}>Propostas</h3>
        <div className="grade-formulario">
          <div className="campo">
            <label>Validade padrão (dias)</label>
            <input type="number" min="0" step="1" value={campos.proposta_validade_dias} onChange={(e) => atualizar('proposta_validade_dias', e.target.value)} />
          </div>
        </div>
        <div className="grade-formulario">
          <div className="campo campo-largo">
            <label>Observações padrão das propostas</label>
            <textarea
              rows={5}
              value={campos.observacoes_padrao}
              onChange={(e) => atualizar('observacoes_padrao', e.target.value)}
              placeholder={'O prazo de entrega está sujeito a alterações em caso de greve...\nA empresa não se responsabiliza por danos causados pela transportadora.'}
            />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              Preenchido automaticamente no campo Observações de novas propostas.
            </span>
          </div>
        </div>

        <h3 style={H3}>Precificação em dólar</h3>
        <div className="grade-formulario">
          <div className="campo">
            <label>Fator de markup sobre preço USD</label>
            <input type="number" min="1" step="0.01" value={campos.fator_markup_usd} onChange={(e) => atualizar('fator_markup_usd', e.target.value)} />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              Preço sugerido = preço USD × cotação do dia × fator. Ex.: 1,30 = 30% de margem.
            </span>
          </div>
        </div>

        <div className="barra-acoes-formulario">
          <button className="botao" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </form>

      {/* ── Cotação do dólar ── */}
      <h3 style={H3}>Cotação do dólar</h3>
      {cotacao ? (
        <p style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text)' }}>
          Última cotação: <strong style={{ color: 'var(--text-h)' }}>
            R$ {Number(cotacao.valor).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}
          </strong> em {cotacao.data?.slice(0, 10).split('-').reverse().join('/')}
          {cotacao.fonte && ` (${cotacao.fonte})`}
        </p>
      ) : (
        <p style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text)' }}>Nenhuma cotação cadastrada ainda.</p>
      )}
      <form onSubmit={salvarCotacao} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="campo" style={{ margin: 0 }}>
          <label>Data</label>
          <input type="date" value={novaCotacaoData} onChange={(e) => setNovaCotacaoData(e.target.value)} required />
        </div>
        <div className="campo" style={{ margin: 0 }}>
          <label>Valor (R$)</label>
          <input type="number" min="0.01" step="0.0001" placeholder="5.7500" value={novaCotacaoValor} onChange={(e) => setNovaCotacaoValor(e.target.value)} required />
        </div>
        <button className="botao" type="submit">Salvar cotação</button>
      </form>

      {/* ── Condições de pagamento ── */}
      <h3 style={H3}>Condições de pagamento</h3>
      <p style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '12px' }}>
        O campo "Corpo" é preenchido automaticamente no campo Condições da proposta ao selecionar esta opção.
      </p>

      {/* Formulário de adição/edição */}
      <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px' }}>
        <div className="grade-formulario">
          <div className="campo">
            <label>Nome da condição (label do select)</label>
            <input
              placeholder="Ex.: 50% na aprovação + 50% na entrega"
              value={novaNome}
              onChange={(e) => setNovaNome(e.target.value)}
            />
          </div>
        </div>
        <div className="campo">
          <label>Corpo (texto completo da proposta)</label>
          <textarea
            rows={7}
            placeholder={'Prazo de entrega: 30 dias úteis\nPeríodo de garantia: 01 ANO\nCondições de pagamento: 50% na aprovação + 50% na entrega\nForma de pagamento: Depósito bancário\nValidade da proposta: 3 dias\nFrete: Não incluso\nPreço fornecido em REAL'}
            value={novaCorpo}
            onChange={(e) => setNovaCorpo(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="botao-secundario" type="button" onClick={salvarCondicao}>
            {editandoId ? 'Salvar alterações' : 'Adicionar condição'}
          </button>
          {editandoId && (
            <button className="botao-secundario" type="button" onClick={cancelarEdicao}>Cancelar</button>
          )}
        </div>
      </div>

      <div className="tabela-wrapper">
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Corpo (prévia)</th>
              <th style={{ width: '130px' }}></th>
            </tr>
          </thead>
          <tbody>
            {condicoes.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text)' }}>Nenhuma condição cadastrada.</td></tr>
            )}
            {condicoes.map((c) => (
              <tr key={c.id} style={editandoId === c.id ? { background: 'var(--bg-alt)' } : {}}>
                <td style={{ verticalAlign: 'top' }}>{c.descricao}</td>
                <td style={{ verticalAlign: 'top', fontSize: '12px', color: 'var(--text)', whiteSpace: 'pre-wrap', maxWidth: '400px' }}>
                  {c.corpo ? c.corpo.slice(0, 120) + (c.corpo.length > 120 ? '…' : '') : <em style={{ opacity: 0.5 }}>sem corpo</em>}
                </td>
                <td>
                  <div className="acoes">
                    <button className="botao-link" type="button" onClick={() => editarCondicao(c)}>Editar</button>
                    <button className="botao-perigo" type="button" onClick={() => removerCondicao(c.id)}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
