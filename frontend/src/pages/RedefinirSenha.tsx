import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

export function RedefinirSenha() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    if (!token) { setErro('Link inválido — token não informado.'); return }
    if (novaSenha.length < 6) { setErro('A senha deve ter ao menos 6 caracteres.'); return }
    if (novaSenha !== confirmacao) { setErro('As senhas não coincidem.'); return }

    setEnviando(true)
    try {
      const res = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaSenha }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Não foi possível redefinir a senha.'); return }
      setSucesso(true)
      setTimeout(() => navigate('/'), 2500)
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
        <h2>Redefinir senha</h2>
        {sucesso ? (
          <p className="alerta-sucesso" role="status">Senha redefinida com sucesso! Redirecionando para o login...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {!token && (
              <p className="alerta-erro" role="alert">
                Link inválido. <Link to="/esqueci-senha">Solicite um novo link</Link>.
              </p>
            )}
            <div className="campo">
              <label htmlFor="novaSenha">Nova senha</label>
              <input
                id="novaSenha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
            </div>
            <div className="campo">
              <label htmlFor="confirmacao">Confirme a nova senha</label>
              <input
                id="confirmacao"
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {erro && <p className="alerta-erro" role="alert">{erro}</p>}
            <button className="botao" type="submit" disabled={enviando || !token} style={{ width: '100%' }}>
              {enviando ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
