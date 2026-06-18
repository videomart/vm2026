import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

export type Usuario = {
  id: number
  nome: string
  email: string
  papel: 'admin' | 'vendedor'
}

type LoginProps = {
  onLogin: (usuario: Usuario) => void
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setEnviando(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, senha }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro ?? 'Não foi possível entrar.')
        return
      }

      onLogin(data.usuario)
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
        <h2>Entrar</h2>
        <form onSubmit={handleSubmit}>
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
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>
          {erro && (
            <p className="alerta-erro" role="alert">
              {erro}
            </p>
          )}
          <button className="botao" type="submit" disabled={enviando} style={{ width: '100%' }}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
          <Link to="/esqueci-senha" style={{ display: 'block', textAlign: 'center', marginTop: '12px', fontSize: '13px' }}>
            Esqueci minha senha
          </Link>
        </form>
      </div>
    </div>
  )
}
