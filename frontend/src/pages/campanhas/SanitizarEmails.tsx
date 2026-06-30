import { useRef, useState } from 'react'

function extrairEmails(texto: string): string[] {
  const candidatos = texto.split(/[\s,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean)
  const validos = candidatos.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  return Array.from(new Set(validos))
}

export function SanitizarEmails() {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{
    total_processados: number
    clientes_atualizados: number
    contatos_atualizados: number
    removidos_de_grupos: number
  } | null>(null)
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  const emails = extrairEmails(texto)

  async function carregarArquivo(file: File) {
    const conteudo = await file.text()
    setTexto((prev) => (prev.trim() ? `${prev}\n${conteudo}` : conteudo))
  }

  async function sanitizar() {
    if (!emails.length) return
    if (!confirm(
      `${emails.length} e-mail(s) serão marcados como inválidos: o cadastro de clientes/contatos correspondentes ` +
      `terá o e-mail apagado (pendente de recadastro) e o endereço será removido de qualquer grupo de envio. Confirma?`,
    )) return

    setEnviando(true)
    setErro(null)
    setResultado(null)
    try {
      const res = await fetch('/api/campanhas/sanitizar-lista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emails }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao sanitizar lista.'); return }
      setResultado(d)
      setTexto('')
    } catch {
      setErro('Erro de conexão ao sanitizar a lista.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section>
      <h2>Sanitizar e-mails</h2>
      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>
        Cole uma lista de e-mails inválidos (de um relatório de bounce, por exemplo) ou importe um arquivo
        .txt/.csv com 1 e-mail por linha. Cada e-mail encontrado nos cadastros de clientes/contatos terá o
        endereço apagado e será marcado como "pendente de recadastro" — mesmo tratamento já usado na
        sanitização automática de campanhas.
      </p>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {resultado && (
        <p className="alerta-sucesso" role="status">
          {resultado.total_processados} e-mail(s) processado(s): {resultado.clientes_atualizados} cliente(s),{' '}
          {resultado.contatos_atualizados} contato(s) atualizados, {resultado.removidos_de_grupos} removido(s) de grupos de envio.
        </p>
      )}

      <div className="campo campo-largo" style={{ maxWidth: '600px' }}>
        <label htmlFor="lista_emails">Lista de e-mails</label>
        <textarea
          id="lista_emails"
          className="sem-uppercase"
          rows={10}
          placeholder={'um e-mail por linha, ex.:\nfulano@dominio.com\nciclano@outrodominio.com'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0 16px' }}>
        <input
          ref={inputArquivoRef}
          type="file"
          accept=".txt,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) carregarArquivo(file)
            e.target.value = ''
          }}
        />
        <button type="button" className="botao-secundario" onClick={() => inputArquivoRef.current?.click()}>
          Importar arquivo (.txt/.csv)
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text)' }}>
          {emails.length} e-mail(s) válido(s) detectado(s)
        </span>
      </div>

      <div className="barra-acoes-formulario">
        <button className="botao-perigo" type="button" onClick={sanitizar} disabled={enviando || !emails.length}>
          {enviando ? 'Sanitizando...' : `Sanitizar ${emails.length || ''} e-mail(s)`}
        </button>
      </div>
    </section>
  )
}
