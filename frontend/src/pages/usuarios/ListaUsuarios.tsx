import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { Paginacao } from '../../components/Paginacao'
import type { Usuario } from './types'

const LABELS_PAPEL: Record<Usuario['papel'], string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
}

export function ListaUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuarioId, setUsuarioId] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(usuarios, 'nome')

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUsuarioId(d?.usuario?.id ?? null))
      .catch(() => {})
  }, [])

  function carregar() {
    setCarregando(true)
    setErro(null)
    const parametros = new URLSearchParams()
    if (busca.trim()) parametros.set('q', busca.trim())
    if (mostrarInativos) parametros.set('incluirInativos', '1')
    fetch(`/api/usuarios?${parametros.toString()}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => { setUsuarios(data.usuarios); grid.resetar() })
      .catch((res) => {
        setErro(res?.status === 403 ? 'Acesso restrito a administradores.' : 'Não foi possível carregar os usuários.')
      })
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [mostrarInativos]) // eslint-disable-line react-hooks/exhaustive-deps

  function formatarData(data: string) {
    return new Date(data).toLocaleDateString('pt-BR')
  }

  async function bloquear(usuario: Usuario) {
    if (!confirm(`Bloquear o usuário "${usuario.nome}"?`)) return
    const res = await fetch(`/api/usuarios/${usuario.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) carregar()
  }

  async function reativar(usuario: Usuario) {
    const res = await fetch(`/api/usuarios/${usuario.id}/reativar`, { method: 'POST', credentials: 'include' })
    if (res.ok) carregar()
  }

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Usuários</h2>
        <Link className="botao" to="/usuarios/novo">+ Novo usuário</Link>
      </div>

      <form className="barra-busca" onSubmit={(e) => { e.preventDefault(); carregar() }}>
        <input
          type="search"
          placeholder="Buscar por nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button className="botao-secundario" type="submit">Buscar</button>
        <label className="opcao-checkbox">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar inativos
        </label>
      </form>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {!erro && (
        <div className="tabela-wrapper">
          {carregando && <p className="estado-vazio">Carregando...</p>}
          {!carregando && usuarios.length === 0 && <p className="estado-vazio">Nenhum usuário encontrado.</p>}
          {!carregando && usuarios.length > 0 && (
            <>
              <table className="tabela">
                <thead>
                  <tr>
                    <th {...grid.th('nome')}>Nome</th>
                    <th {...grid.th('email')}>E-mail</th>
                    <th {...grid.th('papel')}>Papel</th>
                    <th {...grid.th('criado_em')}>Cadastrado em</th>
                    <th {...grid.th('ativo')}>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.pagina_atual.map((usuario) => (
                    <tr key={usuario.id}>
                      <td>
                        {usuario.nome}
                        {usuario.id === usuarioId && <span style={{ color: 'var(--text)' }}> (você)</span>}
                      </td>
                      <td>{usuario.email}</td>
                      <td>{LABELS_PAPEL[usuario.papel]}</td>
                      <td>{formatarData(usuario.criado_em)}</td>
                      <td>
                        {usuario.ativo
                          ? <span className="badge badge-ativo">Ativo</span>
                          : <span className="badge badge-inativo">Inativo</span>}
                      </td>
                      <td>
                        <div className="acoes">
                          <Link className="botao-link" to={`/usuarios/${usuario.id}/editar`}>Editar</Link>
                          {usuario.ativo
                            ? usuario.id !== usuarioId && (
                              <button className="botao-perigo" type="button" onClick={() => bloquear(usuario)}>Bloquear</button>
                            )
                            : <button className="botao-secundario" type="button" onClick={() => reativar(usuario)}>Reativar</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Paginacao
                pagina={grid.pagina}
                totalPaginas={grid.totalPaginas}
                total={grid.total}
                tamanho={grid.tamanho}
                onIrPara={grid.irPara}
                onMudarTamanho={grid.mudarTamanho}
              />
            </>
          )}
        </div>
      )}
    </section>
  )
}
