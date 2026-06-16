import { useState } from 'react'

type Props = {
  propostaId: number
  clienteEmail: string | null
  clienteNome: string
  onFechar: () => void
}

export function ModalEmailProposta({ propostaId, clienteEmail, clienteNome, onFechar }: Props) {
  const [para, setPara] = useState(clienteEmail ?? '')
  const [assunto, setAssunto] = useState(`Proposta Comercial #${propostaId}`)
  const [mensagem, setMensagem] = useState(`Prezado(a) ${clienteNome},\n\nSegue em anexo a Proposta Comercial #${propostaId} para sua apreciação.\n\nEstamos à disposição para qualquer esclarecimento.`)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!para.trim()) return
    setEnviando(true)
    setErro(null)
    setResultado(null)
    try {
      const res = await fetch(`/api/propostas/${propostaId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ para: para.trim(), assunto: assunto.trim(), mensagem: mensagem.trim() }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao enviar.'); return }
      setResultado(`E-mail enviado para ${d.enviado_para}`)
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-cabecalho">
          <h3>Enviar proposta por e-mail</h3>
          <button className="modal-fechar" type="button" onClick={onFechar}>×</button>
        </div>

        {resultado ? (
          <div style={{ padding: '16px 0' }}>
            <p className="alerta-sucesso">{resultado}</p>
            <div className="barra-acoes-formulario">
              <button className="botao" type="button" onClick={onFechar}>Fechar</button>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar}>
            {erro && <p className="alerta-erro" role="alert">{erro}</p>}
            <div className="campo">
              <label htmlFor="email-para">Para *</label>
              <input
                id="email-para"
                type="email"
                value={para}
                onChange={(e) => setPara(e.target.value)}
                required
                placeholder="email@cliente.com.br"
              />
            </div>
            <div className="campo">
              <label htmlFor="email-assunto">Assunto *</label>
              <input
                id="email-assunto"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="email-mensagem">Mensagem</label>
              <textarea
                id="email-mensagem"
                rows={7}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="sem-uppercase"
              />
              <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                O link para visualização da proposta é adicionado automaticamente ao final.
              </span>
            </div>
            <div className="barra-acoes-formulario">
              <button type="button" className="botao-secundario" onClick={onFechar}>Cancelar</button>
              <button type="submit" className="botao" disabled={enviando || !para}>
                {enviando ? 'Enviando...' : 'Enviar e-mail'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
