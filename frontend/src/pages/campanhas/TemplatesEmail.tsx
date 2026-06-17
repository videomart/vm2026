import { useEffect, useState } from 'react'
import { EditorHtml } from '../../components/EditorHtml'

type Template = { id: number; nome: string; assunto: string | null; corpo_html: string | null }

const VAZIO = { nome: '', assunto: '', corpo_html: '' }

export function TemplatesEmail() {
  const [lista, setLista] = useState<Template[]>([])
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState(VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function carregar() {
    fetch('/api/templates-email', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLista(d.templates ?? []))
      .catch(() => setErro('Erro ao carregar templates.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  function novoTemplate() {
    setEditandoId(null)
    setForm(VAZIO)
    setErro(null)
    setMsg(null)
  }

  function editar(t: Template) {
    setEditandoId(t.id)
    setForm({ nome: t.nome, assunto: t.assunto ?? '', corpo_html: t.corpo_html ?? '' })
    setErro(null)
    setMsg(null)
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(editandoId ? `/api/templates-email/${editandoId}` : '/api/templates-email', {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar.'); return }
      setMsg(editandoId ? 'Template atualizado.' : 'Template criado.')
      novoTemplate()
      carregar()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Remover o template "${nome}"?`)) return
    await fetch(`/api/templates-email/${id}`, { method: 'DELETE', credentials: 'include' })
    if (editandoId === id) novoTemplate()
    setLista((l) => l.filter((t) => t.id !== id))
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Templates de e-mail</h2>
      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        Modelos reutilizáveis de assunto/corpo para campanhas de e-mail.
      </p>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px' }}>
        {/* Lista de templates */}
        <div>
          <button className="botao" type="button" onClick={novoTemplate} style={{ width: '100%', marginBottom: '10px' }}>
            + Novo template
          </button>
          <div className="tabela-wrapper">
            <table className="tabela">
              <tbody>
                {lista.length === 0 && (
                  <tr><td style={{ textAlign: 'center' }}>Nenhum template.</td></tr>
                )}
                {lista.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer', background: editandoId === t.id ? 'var(--bg-alt)' : undefined }}>
                    <td onClick={() => editar(t)}>{t.nome}</td>
                    <td style={{ width: '40px' }}>
                      <button className="botao-perigo" type="button" onClick={() => remover(t.id, t.nome)} style={{ padding: '2px 6px', fontSize: '11px' }}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formulário */}
        <div>
          <div className="campo">
            <label>Nome do template</label>
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Aviso de atualização TVPlay" />
          </div>
          <div className="campo">
            <label>Assunto padrão</label>
            <input className="sem-uppercase" value={form.assunto} onChange={(e) => setForm((f) => ({ ...f, assunto: e.target.value }))} placeholder="Assunto do e-mail" />
          </div>
          <div className="campo">
            <label>Corpo</label>
            <EditorHtml
              value={form.corpo_html}
              onChange={(html) => setForm((f) => ({ ...f, corpo_html: html }))}
              placeholder="Escreva o conteúdo do e-mail..."
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
            {editandoId && (
              <button className="botao-secundario" type="button" onClick={novoTemplate}>Cancelar</button>
            )}
            <button className="botao" type="button" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar template'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
