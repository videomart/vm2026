import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

export function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setMensagem(null)
    setEnviando(true)
    try {
      const res = await fetch('/api/auth/esqueci-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Não foi possível processar a solicitação.'); return }
      setMensagem(data.mensagem ?? 'Se este e-mail estiver cadastrado, enviamos um link de redefinição.')
    } catch {
      setErro('Erro de conexão com o servidor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="tela-login">
      <div className="cartao-login">
        <h1>vm2026</h1>
        <h2>Esqueci minha senha</h2>
        {mensagem ? (
          <>
            <p className="alerta-sucesso" role="status">{mensagem}</p>
            <Link className="botao" to="/" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none', marginTop: '12px' }}>
              Voltar ao login
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
              Informe seu e-mail cadastrado. Enviaremos um link para você escolher uma nova senha.
            </p>
            <div className="campo">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {erro && <p className="alerta-erro" role="alert">{erro}</p>}
            <button className="botao" type="submit" disabled={enviando} style={{ width: '100%' }}>
              {enviando ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
            <Link to="/" style={{ display: 'block', textAlign: 'center', marginTop: '12px', fontSize: '13px' }}>
              Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
