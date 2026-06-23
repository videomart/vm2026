import { useEffect, useState } from 'react'
import { mascaraCNPJouCPF, mascaraTelefone } from '../../utils/validacoes'

type Fornecedor = {
  id: number
  razao_social: string
  nome_fantasia: string | null
  cnpj_cpf: string | null
  email: string | null
  telefone: string | null
  observacoes: string | null
  cliente_id: number | null
  cliente_vinculado_nome: string | null
  ativo: 0 | 1
}

type ClienteBusca = { id: number; razao_social: string }

const VAZIO = { razao_social: '', nome_fantasia: '', cnpj_cpf: '', email: '', telefone: '', observacoes: '' }

export function Fornecedores() {
  const [lista, setLista] = useState<Fornecedor[]>([])
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState(VAZIO)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // vínculo opcional com cliente já cadastrado (empresa que atua como cliente E fornecedor)
  const [clienteVinculado, setClienteVinculado] = useState<ClienteBusca | null>(null)
  const [clienteBusca, setClienteBusca] = useState('')
  const [resultadoBuscaCliente, setResultadoBuscaCliente] = useState<ClienteBusca[]>([])

  function carregar() {
    const params = new URLSearchParams()
    if (busca.trim()) params.set('q', busca.trim())
    if (mostrarInativos) params.set('incluirInativos', '1')
    fetch(`/api/fornecedores?${params}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLista(d.fornecedores ?? []))
      .catch(() => setErro('Erro ao carregar fornecedores.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [mostrarInativos]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!clienteBusca.trim()) { setResultadoBuscaCliente([]); return }
    const timer = setTimeout(async () => {
      const r = await fetch(`/api/clientes?q=${encodeURIComponent(clienteBusca)}`, { credentials: 'include' })
      const d = await r.json()
      setResultadoBuscaCliente((d.clientes ?? []).slice(0, 10))
    }, 300)
    return () => clearTimeout(timer)
  }, [clienteBusca])

  function novo() {
    setEditandoId(null)
    setForm(VAZIO)
    setClienteVinculado(null)
    setClienteBusca('')
    setErro(null)
    setMsg(null)
  }

  function editar(f: Fornecedor) {
    setEditandoId(f.id)
    setForm({
      razao_social: f.razao_social,
      nome_fantasia: f.nome_fantasia ?? '',
      cnpj_cpf: f.cnpj_cpf ? mascaraCNPJouCPF(f.cnpj_cpf) : '',
      email: f.email ?? '',
      telefone: f.telefone ? mascaraTelefone(f.telefone) : '',
      observacoes: f.observacoes ?? '',
    })
    setClienteVinculado(f.cliente_id ? { id: f.cliente_id, razao_social: f.cliente_vinculado_nome ?? '' } : null)
    setClienteBusca('')
    setErro(null)
    setMsg(null)
  }

  async function salvar() {
    if (!form.razao_social.trim()) { setErro('Razão social é obrigatória.'); return }
    setSalvando(true)
    setErro(null)
    try {
      const corpo = {
        ...form,
        cnpj_cpf: form.cnpj_cpf.replace(/\D/g, '') || null,
        telefone: form.telefone.replace(/\D/g, '') || null,
        cliente_id: clienteVinculado?.id ?? null,
      }
      const res = await fetch(editandoId ? `/api/fornecedores/${editandoId}` : '/api/fornecedores', {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(corpo),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar.'); return }
      setMsg(editandoId ? 'Fornecedor atualizado.' : 'Fornecedor criado.')
      novo()
      carregar()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function inativar(f: Fornecedor) {
    if (!confirm(`Inativar o fornecedor "${f.razao_social}"?`)) return
    const res = await fetch(`/api/fornecedores/${f.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) carregar()
  }

  async function reativar(f: Fornecedor) {
    const res = await fetch(`/api/fornecedores/${f.id}/reativar`, { method: 'POST', credentials: 'include' })
    if (res.ok) carregar()
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Fornecedores</h2>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div className="painel-mestre-detalhe" style={{ gridTemplateColumns: '280px 1fr' }}>
        {/* Lista */}
        <div>
          <button className="botao" type="button" onClick={novo} style={{ width: '100%', marginBottom: '10px' }}>
            + Novo fornecedor
          </button>
          <input
            type="search"
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') carregar() }}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <label className="opcao-checkbox" style={{ marginBottom: '8px' }}>
            <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
            Mostrar inativos
          </label>
          <div className="tabela-wrapper">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Razão social</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr><td colSpan={2} style={{ textAlign: 'center' }}>Nenhum fornecedor.</td></tr>
                )}
                {lista.map((f) => (
                  <tr key={f.id} style={{ background: editandoId === f.id ? 'var(--bg-alt)' : undefined }}>
                    <td onClick={() => editar(f)} style={{ cursor: 'pointer' }}>
                      {f.razao_social}
                      {!f.ativo && <span className="badge badge-inativo" style={{ marginLeft: '6px', fontSize: '10px' }}>inativo</span>}
                      {f.cliente_vinculado_nome && (
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text)' }}>também cliente: {f.cliente_vinculado_nome}</span>
                      )}
                    </td>
                    <td>
                      <button className="botao-link" type="button" onClick={() => editar(f)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formulário */}
        <div>
          <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 2fr 1fr' }}>
            <div className="campo">
              <label>Razão social *</label>
              <input value={form.razao_social} onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))} required />
            </div>
            <div className="campo">
              <label>Nome fantasia</label>
              <input value={form.nome_fantasia} onChange={(e) => setForm((f) => ({ ...f, nome_fantasia: e.target.value }))} />
            </div>
            <div className="campo">
              <label>CNPJ/CPF</label>
              <input value={form.cnpj_cpf} onChange={(e) => setForm((f) => ({ ...f, cnpj_cpf: mascaraCNPJouCPF(e.target.value) }))} />
            </div>
          </div>
          <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="campo">
              <label>E-mail</label>
              <input className="sem-uppercase" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="campo">
              <label>Telefone</label>
              <input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: mascaraTelefone(e.target.value) }))} maxLength={15} />
            </div>
          </div>
          <div className="campo">
            <label>Observações</label>
            <textarea className="sem-uppercase" rows={3} value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
          </div>

          <div className="campo" style={{ position: 'relative' }}>
            <label>Vincular a um cliente já cadastrado (opcional)</label>
            <input
              value={clienteVinculado ? clienteVinculado.razao_social : clienteBusca}
              onChange={(e) => { setClienteVinculado(null); setClienteBusca(e.target.value) }}
              placeholder="Buscar cliente, se esta empresa também for cliente..."
              autoComplete="off"
            />
            {clienteVinculado && (
              <button className="botao-link" type="button" onClick={() => setClienteVinculado(null)} style={{ marginTop: '4px' }}>
                Remover vínculo
              </button>
            )}
            {resultadoBuscaCliente.length > 0 && !clienteVinculado && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                {resultadoBuscaCliente.map((c) => (
                  <div
                    key={c.id}
                    style={{ padding: '7px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border)' }}
                    onClick={() => { setClienteVinculado(c); setClienteBusca(''); setResultadoBuscaCliente([]) }}
                  >
                    {c.razao_social}
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '12px', color: 'var(--text)', margin: '4px 0 0' }}>
              Use quando a mesma empresa atua como cliente e fornecedor — não altera o cadastro do cliente, só associa os dois registros.
            </p>
          </div>

          <div className="barra-acoes-formulario">
            {editandoId && (
              <>
                {lista.find((f) => f.id === editandoId)?.ativo ? (
                  <button
                    className="botao-perigo"
                    type="button"
                    onClick={() => inativar(lista.find((f) => f.id === editandoId)!)}
                    style={{ marginRight: 'auto' }}
                  >
                    Inativar fornecedor
                  </button>
                ) : (
                  <button
                    className="botao-secundario"
                    type="button"
                    onClick={() => reativar(lista.find((f) => f.id === editandoId)!)}
                    style={{ marginRight: 'auto' }}
                  >
                    Reativar fornecedor
                  </button>
                )}
                <button className="botao-secundario" type="button" onClick={novo}>Cancelar</button>
              </>
            )}
            <button className="botao" type="button" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar fornecedor'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
