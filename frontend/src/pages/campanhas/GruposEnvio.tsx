import { useEffect, useRef, useState } from 'react'

type Grupo = { id: number; nome: string; descricao: string | null; total_clientes: number }
type ClienteGrupo = { id: number; nome: string; email: string | null }
type ClienteBusca = { id: number; razao_social: string; email: string | null }
type CategoriaCliente = { id: number; nome: string }
type EmailExtra = { id: number; email: string; nome: string | null }

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
  const [edicaoNome, setEdicaoNome] = useState('')
  const [edicaoDesc, setEdicaoDesc] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<CategoriaCliente[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<Record<number, string>>({})
  const [adicionandoCategoria, setAdicionandoCategoria] = useState<number | null>(null)
  const [emailsExtra, setEmailsExtra] = useState<EmailExtra[]>([])
  const [textoImportacao, setTextoImportacao] = useState('')
  const [importando, setImportando] = useState(false)
  const [termoInteresse, setTermoInteresse] = useState<Record<number, string>>({})
  const [adicionandoInteresse, setAdicionandoInteresse] = useState<number | null>(null)
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
    if (grupoAberto === id) { setGrupoAberto(null); setClientesGrupo([]); setEmailsExtra([]); return }
    try {
      const d = await fetch(`/api/campanhas/grupos/${id}`, { credentials: 'include' }).then((r) => r.json())
      setClientesGrupo(d.clientes ?? [])
      setEmailsExtra(d.emailsExtra ?? [])
      setGrupoAberto(id)
      setBusca('')
      setResultadoBusca([])
      setTextoImportacao('')
      const grupo = grupos.find((g) => g.id === id)
      setEdicaoNome(grupo?.nome ?? '')
      setEdicaoDesc(grupo?.descricao ?? '')
    } catch {
      setErro('Erro ao carregar clientes do grupo.')
    }
  }

  async function salvarEdicaoGrupo(id: number) {
    if (!edicaoNome.trim()) { setErro('Nome é obrigatório.'); return }
    setSalvandoEdicao(true)
    setErro(null)
    try {
      const res = await fetch(`/api/campanhas/grupos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nome: edicaoNome.trim(), descricao: edicaoDesc.trim() || null }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar grupo.'); return }
      setGrupos((prev) => prev.map((g) => g.id === id ? { ...g, nome: edicaoNome.trim(), descricao: edicaoDesc.trim() || null } : g).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setMsg('Grupo atualizado.')
    } catch {
      setErro('Erro de conexão ao salvar grupo.')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  async function importarEmails(grupoId: number) {
    if (!textoImportacao.trim()) return
    setImportando(true)
    setErro(null)
    setMsg(null)
    try {
      const res = await fetch(`/api/campanhas/grupos/${grupoId}/emails-extra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ texto: textoImportacao }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao importar e-mails.'); return }
      const novosTotal = (d.emailsExtra ?? []).length - emailsExtra.length
      setEmailsExtra(d.emailsExtra ?? [])
      setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, total_clientes: g.total_clientes + Math.max(0, novosTotal) } : g))
      setTextoImportacao('')
      setMsg(`${d.total_encontrados} e-mail(s) encontrado(s) no texto.`)
    } catch {
      setErro('Erro de conexão ao importar e-mails.')
    } finally {
      setImportando(false)
    }
  }

  function onArquivoTxt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setTextoImportacao((prev) => prev ? `${prev}\n${reader.result}` : String(reader.result))
    reader.readAsText(file)
    e.target.value = ''
  }

  async function removerEmailExtra(grupoId: number, emailId: number) {
    try {
      await fetch(`/api/campanhas/grupos/${grupoId}/emails-extra/${emailId}`, { method: 'DELETE', credentials: 'include' })
      setEmailsExtra((prev) => prev.filter((e) => e.id !== emailId))
      setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, total_clientes: Math.max(0, g.total_clientes - 1) } : g))
    } catch {
      setErro('Erro ao remover e-mail.')
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

  async function adicionarPorInteresse(grupoId: number) {
    const termo = (termoInteresse[grupoId] ?? '').trim()
    if (!termo) return
    setAdicionandoInteresse(grupoId)
    setErro(null)
    try {
      const r = await fetch(`/api/campanhas/clientes-por-interesse?q=${encodeURIComponent(termo)}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok) { setErro(d.erro ?? 'Erro ao buscar clientes por interesse.'); return }
      const candidatos: { id: number; nome: string; email: string }[] = (d.clientes ?? []).filter((c: any) => c.email)
      if (!candidatos.length) { setErro(`Nenhum cliente comprou ou demonstrou interesse em "${termo}".`); return }
      const idsNoGrupo = new Set(clientesGrupo.map((c) => c.id))
      const novos = candidatos.filter((c) => !idsNoGrupo.has(c.id))
      if (!novos.length) { setMsg(`Todos os ${candidatos.length} cliente(s) encontrado(s) já estão no grupo.`); return }
      await fetch(`/api/campanhas/grupos/${grupoId}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cliente_ids: novos.map((c) => c.id) }),
      })
      setClientesGrupo((prev) => [...prev, ...novos.map((c) => ({ id: c.id, nome: c.nome, email: c.email }))].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, total_clientes: g.total_clientes + novos.length } : g))
      setMsg(`${novos.length} cliente(s) adicionado(s) (encontrados ${candidatos.length} para "${termo}").`)
    } catch {
      setErro('Erro ao buscar clientes por interesse.')
    } finally {
      setAdicionandoInteresse(null)
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="campo" style={{ margin: 0, flex: '1 1 200px' }}>
            <label>Nome do grupo</label>
            <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Clientes TVPlay" />
          </div>
          <div className="campo" style={{ margin: 0, flex: '2 1 320px' }}>
            <label>Descrição (opcional)</label>
            <input value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} placeholder="Para que serve este grupo?" />
          </div>
          <button className="botao" type="button" onClick={criarGrupo}>Criar grupo</button>
        </div>
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
              {/* Editar nome/descrição do grupo */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', margin: '12px 0', flexWrap: 'wrap' }}>
                <div className="campo" style={{ margin: 0, flex: '1 1 200px' }}>
                  <label>Nome do grupo</label>
                  <input value={edicaoNome} onChange={(e) => setEdicaoNome(e.target.value)} />
                </div>
                <div className="campo" style={{ margin: 0, flex: '2 1 320px' }}>
                  <label>Descrição (opcional)</label>
                  <input value={edicaoDesc} onChange={(e) => setEdicaoDesc(e.target.value)} placeholder="Para que serve este grupo?" />
                </div>
                <button
                  className="botao-secundario"
                  type="button"
                  disabled={salvandoEdicao || (edicaoNome === g.nome && edicaoDesc === (g.descricao ?? ''))}
                  onClick={() => salvarEdicaoGrupo(g.id)}
                >
                  {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>

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

              {/* Adicionar clientes que compraram ou se interessaram por um produto/marca */}
              <div style={{ display: 'flex', gap: '8px', margin: '12px 0', alignItems: 'flex-end' }}>
                <div className="campo" style={{ margin: 0, flex: 1 }}>
                  <label>Adicionar por produto/marca comprado ou de interesse</label>
                  <input
                    className="sem-uppercase"
                    placeholder="Ex.: TVPLAY, VIDEOMART..."
                    value={termoInteresse[g.id] ?? ''}
                    onChange={(e) => setTermoInteresse((prev) => ({ ...prev, [g.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarPorInteresse(g.id) } }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text)' }}>
                    Busca clientes com propostas contendo o termo (compraram) e leads que mencionam o termo (interessados).
                  </span>
                </div>
                <button
                  className="botao-secundario"
                  type="button"
                  disabled={!termoInteresse[g.id]?.trim() || adicionandoInteresse === g.id}
                  onClick={() => adicionarPorInteresse(g.id)}
                >
                  {adicionandoInteresse === g.id ? 'Buscando...' : '+ Adicionar todos'}
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

              {/* Importar lista de e-mails (copy/paste ou arquivo .txt) */}
              <div style={{ margin: '16px 0', padding: '12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Importar lista de e-mails
                </label>
                <p style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '6px' }}>
                  Um por linha. Para incluir o nome, use o formato <code>Nome &lt;email@dominio.com&gt;</code> —
                  sem nome, basta colar o e-mail (aceita também vários soltos numa linha, separados por vírgula ou espaço).
                </p>
                <textarea
                  className="sem-uppercase"
                  rows={3}
                  placeholder={'João Silva <joao@empresa.com>\nmaria@empresa.com'}
                  value={textoImportacao}
                  onChange={(e) => setTextoImportacao(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  <label className="botao-secundario" style={{ cursor: 'pointer', fontSize: '12px', padding: '6px 12px' }}>
                    Escolher arquivo .txt
                    <input type="file" accept=".txt" style={{ display: 'none' }} onChange={onArquivoTxt} />
                  </label>
                  <span style={{ flex: 1 }} />
                  <button
                    className="botao"
                    type="button"
                    disabled={!textoImportacao.trim() || importando}
                    onClick={() => importarEmails(g.id)}
                  >
                    {importando ? 'Importando...' : 'Importar e-mails'}
                  </button>
                </div>
              </div>

              {/* E-mails avulsos importados */}
              {emailsExtra.length > 0 && (
                <div className="tabela-wrapper" style={{ marginBottom: '16px' }}>
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail importado</th>
                        <th style={{ width: '80px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailsExtra.map((e) => (
                        <tr key={e.id}>
                          <td>{e.nome ?? <em style={{ opacity: 0.5 }}>sem nome</em>}</td>
                          <td>{e.email}</td>
                          <td>
                            <button className="botao-perigo" type="button" onClick={() => removerEmailExtra(g.id, e.id)}>
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabela de clientes do grupo */}
              {clientesGrupo.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text)', marginTop: '8px' }}>
                  Nenhum cliente neste grupo ainda. Use o campo acima para adicionar.
                </p>
              ) : (
                <div className="tabela-wrapper" style={{ marginTop: '8px' }}>
                  <table className="tabela" style={{ minWidth: '480px' }}>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>E-mail</th>
                        <th style={{ width: '120px', whiteSpace: 'nowrap' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesGrupo.map((c) => (
                        <tr key={c.id}>
                          <td>{c.nome}</td>
                          <td>{c.email ?? <em style={{ opacity: 0.5 }}>sem e-mail</em>}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
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
