import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditorHtml } from '../../components/EditorHtml'

type Grupo = { id: number; nome: string; total_clientes: number }
type Template = { id: number; nome: string; assunto: string | null; corpo_html: string | null }

export function NovaCampanha() {
  const navigate = useNavigate()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [grupoId, setGrupoId] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [incluirContatos, setIncluirContatos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ total: number; erros?: string[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/campanhas/grupos', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGrupos(d.grupos ?? []))
    fetch('/api/templates-email', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
  }, [])

  function carregarTemplate(id: string) {
    const t = templates.find((x) => String(x.id) === id)
    if (!t) return
    if (t.assunto) setAssunto(t.assunto)
    setCorpo(t.corpo_html ?? '')
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!grupoId || !assunto.trim() || !corpo.trim()) return
    setEnviando(true)
    setErro(null)
    setResultado(null)
    try {
      const res = await fetch('/api/campanhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          grupo_id: Number(grupoId),
          assunto: assunto.trim(),
          corpo: corpo.trim(),
          incluir_contatos: incluirContatos,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao enviar.'); return }
      setResultado({ total: d.total, erros: d.erros })
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setEnviando(false)
    }
  }

  const grupoSelecionado = grupos.find((g) => String(g.id) === grupoId)

  return (
    <section>
      <h2>Nova campanha de e-mail</h2>

      {resultado && (
        <div className="alerta-sucesso" role="status">
          <strong>Campanha enviada!</strong> {resultado.total} e-mail(s) disparado(s).
          {resultado.erros && resultado.erros.length > 0 && (
            <details style={{ marginTop: '8px' }}>
              <summary>{resultado.erros.length} erro(s)</summary>
              <ul style={{ margin: '4px 0 0 16px', fontSize: '12px' }}>
                {resultado.erros.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <form onSubmit={enviar}>
        <div className="grade-formulario">
          <div className="campo">
            <label htmlFor="grupo">Grupo de destinatários *</label>
            <select id="grupo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)} required>
              <option value="">— Selecione um grupo —</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome} ({g.total_clientes} cliente(s))
                </option>
              ))}
            </select>
            {grupoSelecionado && grupoSelecionado.total_clientes === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--danger)' }}>
                Este grupo não tem clientes com e-mail cadastrado.
              </span>
            )}
            <label className="opcao-checkbox" style={{ marginTop: '8px' }}>
              <input type="checkbox" checked={incluirContatos} onChange={(e) => setIncluirContatos(e.target.checked)} />
              Incluir contatos das empresas
            </label>
          </div>
          <div className="campo">
            <label htmlFor="template">Carregar template</label>
            <select id="template" value="" onChange={(e) => carregarTemplate(e.target.value)}>
              <option value="">— Selecionar modelo —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="campo campo-largo">
            <label htmlFor="assunto">Assunto *</label>
            <input
              id="assunto"
              className="sem-uppercase"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              required
              placeholder="Ex.: Atualização do TVPlay — ação necessária"
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="corpo">Corpo do e-mail *</label>
          <EditorHtml value={corpo} onChange={setCorpo} placeholder="Escreva o conteúdo do e-mail..." />
        </div>

        <div className="barra-acoes-formulario">
          <button type="button" className="botao-secundario" onClick={() => navigate('/campanhas')}>Cancelar</button>
          <button type="submit" className="botao" disabled={enviando || !grupoId}>
            {enviando ? 'Enviando...' : 'Disparar campanha'}
          </button>
        </div>
      </form>
    </section>
  )
}
