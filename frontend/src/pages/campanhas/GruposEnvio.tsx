import { useEffect, useState } from 'react'

type Grupo = { id: number; nome: string; descricao: string | null; total_clientes: number }
type Cliente = { id: number; nome: string; email: string | null }
type ClienteGrupo = { id: number; nome: string; email: string | null }

export function GruposEnvio() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [grupoAberto, setGrupoAberto] = useState<number | null>(null)
  const [clientesGrupo, setClientesGrupo] = useState<ClienteGrupo[]>([])
  const [todosClientes, setTodosClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novaDesc, setNovaDesc] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/campanhas/grupos', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGrupos(d.grupos ?? []))
    fetch('/api/clientes?por_pagina=9999', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setTodosClientes(d.clientes ?? []))
  }, [])

  async function abrirGrupo(id: number) {
    if (grupoAberto === id) { setGrupoAberto(null); return }
    const d = await fetch(`/api/campanhas/grupos/${id}`, { credentials: 'include' }).then((r) => r.json())
    setClientesGrupo(d.clientes ?? [])
    setGrupoAberto(id)
    setBusca('')
  }

  async function criarGrupo() {
    if (!novoNome.trim()) return
    setErro(null)
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
  }

  async function removerGrupo(id: number) {
    if (!confirm('Remover este grupo e desvincular todos os clientes?')) return
    await fetch(`/api/campanhas/grupos/${id}`, { method: 'DELETE', credentials: 'include' })
    setGrupos((prev) => prev.filter((g) => g.id !== id))
    if (grupoAberto === id) setGrupoAberto(null)
  }

  async function adicionarCliente(grupoId: number, clienteId: number) {
    await fetch(`/api/campanhas/grupos/${grupoId}/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cliente_ids: [clienteId] }),
    })
    const cliente = todosClientes.find((c) => c.id === clienteId)
    if (cliente) {
      setClientesGrupo((prev) => [...prev, cliente].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, total_clientes: g.total_clientes + 1 } : g))
    }
    setBusca('')
  }

  async function removerCliente(grupoId: number, clienteId: number) {
    await fetch(`/api/campanhas/grupos/${grupoId}/clientes/${clienteId}`, {
      method: 'DELETE', credentials: 'include',
    })
    setClientesGrupo((prev) => prev.filter((c) => c.id !== clienteId))
    setGrupos((prev) => prev.map((g) => g.id === grupoId ? { ...g, total_clientes: Math.max(0, g.total_clientes - 1) } : g))
  }

  const clientesNoGrupo = new Set(clientesGrupo.map((c) => c.id))
  const clientesFiltrados = todosClientes.filter(
    (c) => !clientesNoGrupo.has(c.id) && c.nome.toLowerCase().includes(busca.toLowerCase()),
  ).slice(0, 20)

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

      {/* Lista de grupos */}
      {grupos.length === 0 && <p style={{ color: 'var(--text)' }}>Nenhum grupo criado ainda.</p>}
      {grupos.map((g) => (
        <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '12px' }}>
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
              onClick={(e) => { e.stopPropagation(); removerGrupo(g.id) }}
              style={{ padding: '2px 8px', fontSize: '12px' }}
            >Remover</button>
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>{grupoAberto === g.id ? '▾' : '▸'}</span>
          </div>

          {grupoAberto === g.id && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
              {/* Buscar e adicionar cliente */}
              <div style={{ margin: '12px 0 8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  placeholder="Buscar cliente para adicionar..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              {busca && clientesFiltrados.length > 0 && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '10px' }}>
                  {clientesFiltrados.map((c) => (
                    <div
                      key={c.id}
                      style={{ padding: '6px 10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onClick={() => adicionarCliente(g.id, c.id)}
                    >
                      <span style={{ fontSize: '13px' }}>{c.nome}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text)' }}>{c.email ?? 'sem e-mail'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Clientes do grupo */}
              {clientesGrupo.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text)' }}>Nenhum cliente neste grupo ainda. Busque acima para adicionar.</p>
              ) : (
                <div className="tabela-wrapper">
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
                            <button className="botao-perigo" type="button" onClick={() => removerCliente(g.id, c.id)}>Remover</button>
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
