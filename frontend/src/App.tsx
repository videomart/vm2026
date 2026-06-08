import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Login } from './pages/Login'
import type { Usuario } from './pages/Login'
import { ListaClientes } from './pages/clientes/ListaClientes'
import { FormularioCliente } from './pages/clientes/FormularioCliente'
import { ListaProdutos } from './pages/produtos/ListaProdutos'
import { FormularioProduto } from './pages/produtos/FormularioProduto'

type SessaoStatus = 'verificando' | 'deslogado' | 'logado'

function App() {
  const [status, setStatus] = useState<SessaoStatus>('verificando')
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.usuario) {
          setUsuario(data.usuario)
          setStatus('logado')
        } else {
          setStatus('deslogado')
        }
      })
      .catch(() => setStatus('deslogado'))
  }, [])

  function handleLogin(usuarioLogado: Usuario) {
    setUsuario(usuarioLogado)
    setStatus('logado')
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUsuario(null)
    setStatus('deslogado')
  }

  if (status === 'verificando') {
    return (
      <main>
        <p>Carregando...</p>
      </main>
    )
  }

  if (status === 'deslogado' || !usuario) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="layout-app">
      <header className="cabecalho">
        <h1>vm2026</h1>
        <nav className="cabecalho-menu">
          <Link to="/clientes">Clientes</Link>
          <Link to="/produtos">Produtos</Link>
        </nav>
        <div className="cabecalho-usuario">
          <span>
            Olá, <strong>{usuario.nome}</strong> ({usuario.papel})
          </span>
          <button className="botao-secundario" type="button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <div className="conteudo">
        <Routes>
          <Route path="/" element={<ListaClientes />} />
          <Route path="/clientes" element={<ListaClientes />} />
          <Route path="/clientes/novo" element={<FormularioCliente />} />
          <Route path="/clientes/:id/editar" element={<FormularioCliente />} />
          <Route path="/produtos" element={<ListaProdutos />} />
          <Route path="/produtos/novo" element={<FormularioProduto />} />
          <Route path="/produtos/:id/editar" element={<FormularioProduto />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
