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
}

type Condicao = { id: number; descricao: string }
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
  }
}

export function Setup() {
  const [campos, setCampos] = useState<SetupData>(SETUP_VAZIO)
  const [condicoes, setCondicoes] = useState<Condicao[]>([])
  const [cotacao, setCotacao] = useState<Cotacao>(null)
  const [novaCondicao, setNovaCondicao] = useState('')
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

  async function adicionarCondicao() {
    if (!novaCondicao.trim()) return
    const res = await fetch('/api/setup/condicoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ descricao: novaCondicao.trim() }),
    })
    const d = await res.json()
    if (res.ok) {
      setCondicoes((c) => [...c, d.condicao].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')))
      setNovaCondicao('')
    } else {
      setErro(d.erro ?? 'Erro ao adicionar condição.')
    }
  }

  async function removerCondicao(id: number) {
    if (!confirm('Remover esta condição?')) return
    await fetch(`/api/setup/condicoes/${id}`, { method: 'DELETE', credentials: 'include' })
    setCondicoes((c) => c.filter((x) => x.id !== id))
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
        <h3 style={{ marginBottom: '12px', marginTop: '24px', fontSize: '15px', color: 'var(--text-h)' }}>Dados da empresa</h3>
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
            <input value={campos.empresa_site} onChange={(e) => atualizar('empresa_site', e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <h3 style={{ marginBottom: '12px', marginTop: '24px', fontSize: '15px', color: 'var(--text-h)' }}>Propostas</h3>
        <div className="grade-formulario">
          <div className="campo">
            <label>Validade padrão (dias)</label>
            <input
              type="number" min="0" step="1"
              value={campos.proposta_validade_dias}
              onChange={(e) => atualizar('proposta_validade_dias', e.target.value)}
            />
          </div>
        </div>

        <h3 style={{ marginBottom: '12px', marginTop: '24px', fontSize: '15px', color: 'var(--text-h)' }}>Precificação em dólar</h3>
        <div className="grade-formulario">
          <div className="campo">
            <label>Fator de markup sobre preço USD</label>
            <input
              type="number" min="1" step="0.01"
              value={campos.fator_markup_usd}
              onChange={(e) => atualizar('fator_markup_usd', e.target.value)}
            />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              Preço sugerido = preço USD × cotação do dia × fator.
              Ex.: 1,30 = 30% de margem sobre o custo convertido.
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
      <h3 style={{ marginBottom: '12px', marginTop: '32px', fontSize: '15px', color: 'var(--text-h)' }}>Cotação do dólar</h3>
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
          <input
            type="number" min="0.01" step="0.0001"
            placeholder="5.7500"
            value={novaCotacaoValor}
            onChange={(e) => setNovaCotacaoValor(e.target.value)}
            required
          />
        </div>
        <button className="botao" type="submit">Salvar cotação</button>
      </form>

      {/* ── Condições de pagamento ── */}
      <h3 style={{ marginBottom: '12px', marginTop: '32px', fontSize: '15px', color: 'var(--text-h)' }}>Condições de pagamento</h3>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: '220px' }}
          placeholder="Nova condição (ex.: 30/60/90 dias)"
          value={novaCondicao}
          onChange={(e) => setNovaCondicao(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarCondicao() } }}
        />
        <button className="botao-secundario" type="button" onClick={adicionarCondicao}>Adicionar</button>
      </div>
      <div className="tabela-wrapper">
        <table className="tabela">
          <thead>
            <tr>
              <th>Descrição</th>
              <th style={{ width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {condicoes.length === 0 && (
              <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text)' }}>Nenhuma condição cadastrada.</td></tr>
            )}
            {condicoes.map((c) => (
              <tr key={c.id}>
                <td>{c.descricao}</td>
                <td>
                  <button className="botao-perigo" type="button" onClick={() => removerCondicao(c.id)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
