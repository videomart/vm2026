import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Papel, Usuario } from './types'

const LABELS_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
}

export function FormularioUsuario() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('vendedor')
  const [senha, setSenha] = useState('')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!editando) return

    fetch(`/api/usuarios/${id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setUsuario(data.usuario)
        setNome(data.usuario.nome)
        setEmail(data.usuario.email)
        setPapel(data.usuario.papel)
      })
      .catch((res) => {
        setErro(res?.status === 403 ? 'Acesso restrito a administradores.' : 'Não foi possível carregar o usuário.')
      })
      .finally(() => setCarregando(false))
  }, [id, editando])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)

    try {
      const body: Record<string, unknown> = { nome, email, papel }
      if (senha) body.senha = senha

      const res = await fetch(editando ? `/api/usuarios/${id}` : '/api/usuarios', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro ?? 'Não foi possível salvar o usuário.')
        return
      }

      navigate('/usuarios')
    } catch {
      setErro('Erro de conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  if (erro && editando && !usuario) {
    return (
      <p className="alerta-erro" role="alert">
        {erro}
      </p>
    )
  }

  return (
    <section>
      <h2>{editando ? 'Editar usuário' : 'Novo usuário'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="grade-formulario">
          <div className="campo">
            <label htmlFor="nome">Nome *</label>
            <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="email">E-mail *</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="papel">Papel</label>
            <select id="papel" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
              {(Object.keys(LABELS_PAPEL) as Papel[]).map((valor) => (
                <option key={valor} value={valor}>
                  {LABELS_PAPEL[valor]}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="senha">{editando ? 'Nova senha' : 'Senha *'}</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={editando ? 'Deixe em branco para manter a atual' : ''}
              required={!editando}
            />
          </div>
        </div>

        {usuario && (
          <p className="valor-secundario">
            Cadastrado em {new Date(usuario.criado_em).toLocaleDateString('pt-BR')}
          </p>
        )}

        {erro && (
          <p className="alerta-erro" role="alert">
            {erro}
          </p>
        )}

        <div className="barra-acoes-formulario">
          <button className="botao" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button className="botao-secundario" type="button" onClick={() => navigate('/usuarios')}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  )
}
