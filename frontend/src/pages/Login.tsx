import { useState } from 'react'
import type { FormEvent } from 'react'

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
    <main>
      <h1>vm2026</h1>
      <h2>Entrar</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">E-mail</label>
          <br />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="senha">Senha</label>
          <br />
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </div>
        {erro && <p role="alert">{erro}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
