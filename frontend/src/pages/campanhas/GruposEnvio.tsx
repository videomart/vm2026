import { useEffect, useRef, useState } from 'react'

type Grupo = { id: number; nome: string; descricao: string | null; total_clientes: number }
type ClienteGrupo = { id: number; nome: string; email: string | null }
type ClienteBusca = { id: number; razao_social: string; email: string | null }
type CategoriaCliente = { id: number; nome: string }

export function GruposEnvio() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [grupoAberto, setGrupoAberto] = useState<number | null>(null)
  const [clientesGrupo, setClientesGrupo] = useState<ClienteGrupo[]>([])
  const [resultadoBusca, setResultadoBusca] = useState<ClienteBusca[]>([])
  const [busca, setBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaDesc, setNovaDesc] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<CategoriaCliente[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<Record<number, string>>({})
  const [adicionandoCategoria, setAdicionandoCategoria] = useState<number | null>(null)
  const buscaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/campanhas/grupos', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGrupos(d.grupos ?? []))
      .catch(() => setErro('Erro ao carregar grupos.'))
      .finally(() => setCarregando(false))
    fetch('/api/categorias-cliente', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias ?? []))
      .catch(() => null)
  }, [])

  // Busca de clientes com debounce
  useEffect(() => {
    if (!busca.trim()) { setResultadoBusca([]); return }
    if (buscaTimer.current) clearTimeout(buscaTimer.current)
    buscaTimer.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await fetch(`/api/clientes?q=${encodeURIComponent(busca)}`, { credentials: 'include' })
        const d = await r.json()
        const clientesNoGrupo = new Set(clientesGrupo.map((c) => c.id))
        setResultadoBusca((d.clientes ?? []).filter((c: ClienteBusca) => !clientesNoGrupo.has(c.id)).slice(0, 15))
      } catch {
        // silencioso
      } finally {
        setBuscando(false)
      }
    }, 300)
    return () => { if (buscaTimer.current) clearTimeout(buscaTimer.current) }
  }, [busca, clientesGrupo])

  async function abrirGrupo(id: number) {
    if (grupoAberto === id) { setGrupoAberto(null); setClientesGrupo([]); return }
    try {
      const d = await fetch(`/api/campanhas/grupos/${id}`, { credentials: 'include' }).then((r) => r.json())
      setClientesGrupo(d.clientes ?? [])
      setGrupoAberto(id)
      setBusca('')
      setResultadoBusca([])
    } catch {
      setErro('Erro ao carregar clientes do grupo.')
    }
  }

  async function criarGrupo() {
    if (!novoNome.trim()) return
    setErro(null)
    try {
      const res = await fetch('/api/campanhas/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nome: novoNome.trim(), descricao: novaDesc.trim() || null }),
      })
      const d = await res.json()
      if (res.ok) {
        setGrupos((prev) => [...prev, { ...d.grupo, total_clientes: 0 }].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
        setNovoNome('')
        setNovaDesc('')
        setMsg('Grupo criado.')
      } else {
        setErro(d.erro ?? 'Erro ao criar grupo.')
      }
    } catch {
      setErro('Erro de conexão.')
    }
  }

  async function removerGrupo(id: number) {
    if (!confirm('Remover este grupo e desvincular todos os clientes?')) return
    try {
      await fetch(`/api/campanhas/grupos/${id}`, { method: 'DELETE', credentials: 'include' })
      setGrupos((prev) => prev.filter((g) => g.id !== id))
      if (grupoAberto === id) { setGrupoAberto(null); setClientesGrupo([]) }
    } catch {
      setErro('Erro ao remover grupo.')
    }
  }

  async function adicionarCliente(grupoId: number, cliente: ClienteBusca) {
    try {
      await fetch(`/api/campanhas/grupos/${grupoId}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cliente_ids: [cliente.id] }),
      })
      setClientesGrupo((prev) => [...prev, { id: cliente.id, nome: cliente.razao_social, email: cliente.email }].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, total_clientes: g.total_clientes + 1 } : g))
      setBusca('')
      setResultadoBusca([])
    } catch {
      setErro('Erro ao adicionar cliente.')
    }
  }

  async function adicionarCategoria(grupoId: number) {
    const categoriaId = categoriaSelecionada[grupoId]
    if (!categoriaId) return
    setAdicionandoCategoria(grupoId)
    setErro(null)
    try {
      const r = await fetch(`/api/clientes?categoria_cliente_id=${categoriaId}`, { credentials: 'include' })
      const d = await r.json()
      const candidatos: ClienteBusca[] = (d.clientes ?? []).filter((c: any) => c.email)
      if (!candidatos.length) { setErro('Nenhum cliente com e-mail nesta categoria.'); return }
      const idsNoGrupo = new Set(clientesGrupo.map((c) => c.id))
      const novos = candidatos.filter((c) => !idsNoGrupo.has(c.id))
      if (!novos.length) { setMsg('Todos os clientes desta categoria já estão no grupo.'); return }
      await fetch(`/api/campanhas/grupos/${grupoId}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cliente_ids: novos.map((c) => c.id) }),
      })
      setClientesGrupo((prev) => [...prev, ...novos.map((c) => ({ id: c.id, nome: c.razao_social, email: c.email }))].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, total_clientes: g.total_clientes + novos.length } : g))
      setMsg(`${novos.length} cliente(s) adicionado(s) ao grupo.`)
    } catch {
      setErro('Erro ao adicionar clientes da categoria.')
    } finally {
      setAdicionandoCategoria(null)
    }
  }

  async function removerCliente(grupoId: number, clienteId: number) {
    try {
      await fetch(`/api/campanhas/grupos/${grupoId}/clientes/${clienteId}`, { method: 'DELETE', credentials: 'include' })
      setClientesGrupo((prev) => prev.filter((c) => c.id !== clienteId))
      setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, total_clientes: Math.max(0, g.total_clientes - 1) } : g))
    } catch {
      setErro('Erro ao remover cliente.')
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Grupos de envio</h2>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {/* Criar grupo */}
      <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
        <div className="grade-formulario">
          <div className="campo">
            <label>Nome do grupo</label>
            <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Clientes TVPlay" />
          </div>
          <div className="campo campo-largo">
            <label>Descrição (opcional)</label>
            <input value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} placeholder="Para que serve este grupo?" />
          </div>
        </div>
        <button className="botao" type="button" onClick={criarGrupo}>Criar grupo</button>
      </div>

      {grupos.length === 0 && <p style={{ color: 'var(--text)' }}>Nenhum grupo criado ainda.</p>}

      {grupos.map((g) => (
        <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '12px' }}>
          {/* Cabeçalho do grupo */}
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: '12px', cursor: 'pointer' }}
            onClick={() => abrirGrupo(g.id)}
          >
            <span style={{ flex: 1, fontWeight: 600 }}>{g.nome}</span>
            {g.descricao && <span style={{ fontSize: '12px', color: 'var(--text)' }}>{g.descricao}</span>}
            <span className="badge-ativo">{g.total_clientes} cliente(s)</span>
            <button
              className="botao-perigo"
              type="button"
              style={{ padding: '2px 8px', fontSize: '12px' }}
              onClick={(e) => { e.stopPropagation(); removerGrupo(g.id) }}
            >
              Remover
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>{grupoAberto === g.id ? '▾' : '▸'}</span>
          </div>

          {/* Painel expandido */}
          {grupoAberto === g.id && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
              {/* Adicionar todos os clientes de uma categoria */}
              <div style={{ display: 'flex', gap: '8px', margin: '12px 0', alignItems: 'flex-end' }}>
                <div className="campo" style={{ margin: 0, flex: 1 }}>
                  <label>Adicionar por categoria</label>
                  <select
                    value={categoriaSelecionada[g.id] ?? ''}
                    onChange={(e) => setCategoriaSelecionada((prev) => ({ ...prev, [g.id]: e.target.value }))}
                  >
                    <option value="">— Selecionar categoria —</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <button
                  className="botao-secundario"
                  type="button"
                  disabled={!categoriaSelecionada[g.id] || adicionandoCategoria === g.id}
                  onClick={() => adicionarCategoria(g.id)}
                >
                  {adicionandoCategoria === g.id ? 'Adicionando...' : '+ Adicionar todos'}
                </button>
              </div>

              {/* Campo de busca para adicionar clientes */}
              <div style={{ margin: '12px 0 4px', position: 'relative' }}>
                <input
                  placeholder="Digite o nome do cliente para adicionar..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ width: '100%' }}
                  autoComplete="off"
                />
                {buscando && (
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text)' }}>
                    buscando...
                  </span>
                )}
              </div>

              {/* Dropdown de resultados */}
              {resultadoBusca.length > 0 && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {resultadoBusca.map((c) => (
                    <div
                      key={c.id}
                      style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}
                      onClick={() => adicionarCliente(g.id, c)}
                    >
                      <span style={{ fontSize: '13px' }}>{c.razao_social}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text)' }}>{c.email ?? 'sem e-mail'}</span>
                    </div>
                  ))}
                </div>
              )}
              {busca && !buscando && resultadoBusca.length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '10px' }}>Nenhum cliente encontrado.</p>
              )}

              {/* Tabela de clientes do grupo */}
              {clientesGrupo.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text)', marginTop: '8px' }}>
                  Nenhum cliente neste grupo ainda. Use o campo acima para adicionar.
                </p>
              ) : (
                <div className="tabela-wrapper" style={{ marginTop: '8px' }}>
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>E-mail</th>
                        <th style={{ width: '80px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesGrupo.map((c) => (
                        <tr key={c.id}>
                          <td>{c.nome}</td>
                          <td>{c.email ?? <em style={{ opacity: 0.5 }}>sem e-mail</em>}</td>
                          <td>
                            <button className="botao-perigo" type="button" onClick={() => removerCliente(g.id, c.id)}>
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
