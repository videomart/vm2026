import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Grupo = { id: number; nome: string; total_clientes: number }

export function NovaCampanha() {
  const navigate = useNavigate()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [grupoId, setGrupoId] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ total: number; erros?: string[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/campanhas/grupos', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGrupos(d.grupos ?? []))
  }, [])

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
        body: JSON.stringify({ grupo_id: Number(grupoId), assunto: assunto.trim(), corpo: corpo.trim() }),
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
          </div>
          <div className="campo campo-largo">
            <label htmlFor="assunto">Assunto *</label>
            <input
              id="assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              required
              placeholder="Ex.: Atualização do TVPlay — ação necessária"
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="corpo">Corpo do e-mail (HTML permitido) *</label>
          <textarea
            id="corpo"
            rows={16}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            required
            placeholder={'<p>Prezado cliente,</p>\n<p>Gostaríamos de informar que...</p>'}
            className="sem-uppercase"
          />
          <span style={{ fontSize: '12px', color: 'var(--text)' }}>
            Você pode usar HTML básico: &lt;p&gt;, &lt;b&gt;, &lt;a href="..."&gt;, &lt;br&gt;, etc.
          </span>
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
