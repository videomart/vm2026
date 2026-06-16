import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Login } from './pages/Login'
import type { Usuario } from './pages/Login'
import { Dashboard } from './pages/dashboard/Dashboard'
import { ListaClientes } from './pages/clientes/ListaClientes'
import { FormularioCliente } from './pages/clientes/FormularioCliente'
import { ListaProdutos } from './pages/produtos/ListaProdutos'
import { FormularioProduto } from './pages/produtos/FormularioProduto'
import { ListaPropostas } from './pages/propostas/ListaPropostas'
import { FormularioProposta } from './pages/propostas/FormularioProposta'
import { ImpressaoProposta } from './pages/propostas/ImpressaoProposta'
import { ListaLeads } from './pages/leads/ListaLeads'
import { FormularioLead } from './pages/leads/FormularioLead'
import { ListaUsuarios } from './pages/usuarios/ListaUsuarios'
import { FormularioUsuario } from './pages/usuarios/FormularioUsuario'
import { Setup } from './pages/setup/Setup'
import { Condicoes } from './pages/setup/Condicoes'
import { Marcas } from './pages/setup/Marcas'
import { Categorias } from './pages/setup/Categorias'
import { ListaCampanhas } from './pages/campanhas/ListaCampanhas'
import { NovaCampanha } from './pages/campanhas/NovaCampanha'
import { GruposEnvio } from './pages/campanhas/GruposEnvio'

type SessaoStatus = 'verificando' | 'deslogado' | 'logado'

const ITEM_NAV = ({ isActive }: { isActive: boolean }) => (isActive ? 'ativo' : '')

const ROTAS_CONFIG = ['/setup', '/usuarios', '/marcas', '/categorias']

function App() {
  const [status, setStatus] = useState<SessaoStatus>('verificando')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const location = useLocation()
  const emConfig = ROTAS_CONFIG.some((r) => location.pathname.startsWith(r))
  const [configAberto, setConfigAberto] = useState(emConfig)

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

  if (location.pathname.endsWith('/imprimir')) {
    return (
      <Routes>
        <Route path="/propostas/:id/imprimir" element={<ImpressaoProposta />} />
      </Routes>
    )
  }

  return (
    <div className="layout-app">
      <header className="topo-mobile">
        <button
          className="botao-menu"
          type="button"
          aria-label="Abrir menu"
          onClick={() => setMenuAberto(true)}
        >
          ☰
        </button>
        <span className="topo-mobile-titulo">vm2026</span>
      </header>

      {menuAberto && <div className="overlay-menu" onClick={() => setMenuAberto(false)} />}

      <aside className={`barra-lateral${menuAberto ? ' aberta' : ''}`}>
        <div className="barra-lateral-topo">
          <h1>vm2026</h1>
          <button
            className="botao-fechar-menu"
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
          >
            ×
          </button>
        </div>
        <nav className="menu-lateral">
          <NavLink to="/" end className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Dashboard</NavLink>
          <NavLink to="/clientes" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Clientes</NavLink>
          <NavLink to="/produtos" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Produtos</NavLink>
          <NavLink to="/propostas" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Propostas</NavLink>
          <NavLink to="/leads" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Leads</NavLink>
          <NavLink to="/campanhas" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>E-mails</NavLink>
          {usuario.papel === 'admin' && (
            <>
              <button
                className={`menu-grupo-btn${emConfig ? ' ativo' : ''}`}
                type="button"
                onClick={() => setConfigAberto((v) => !v)}
              >
                <span>Configurações</span>
                <span className="menu-grupo-seta">{configAberto ? '▾' : '▸'}</span>
              </button>
              {configAberto && (
                <div className="menu-subgrupo">
                  <NavLink to="/setup" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Empresa / Sistema</NavLink>
                  <NavLink to="/setup/condicoes" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Condições de pagamento</NavLink>
                  <NavLink to="/usuarios" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Usuários</NavLink>
                  <NavLink to="/marcas" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Marcas</NavLink>
                  <NavLink to="/categorias" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Categorias</NavLink>
                </div>
              )}
            </>
          )}
        </nav>
        <div className="barra-lateral-rodape">
          <span>
            Olá, <strong>{usuario.nome}</strong> ({usuario.papel})
          </span>
          <button className="botao-secundario" type="button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </aside>

      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<ListaClientes />} />
          <Route path="/clientes/novo" element={<FormularioCliente />} />
          <Route path="/clientes/:id/editar" element={<FormularioCliente />} />
          <Route path="/produtos" element={<ListaProdutos />} />
          <Route path="/produtos/novo" element={<FormularioProduto />} />
          <Route path="/produtos/:id/editar" element={<FormularioProduto />} />
          <Route path="/propostas" element={<ListaPropostas />} />
          <Route path="/propostas/nova" element={<FormularioProposta />} />
          <Route path="/propostas/:id" element={<FormularioProposta />} />
          <Route path="/leads" element={<ListaLeads />} />
          <Route path="/leads/novo" element={<FormularioLead />} />
          <Route path="/leads/:id" element={<FormularioLead />} />
          <Route path="/usuarios" element={<ListaUsuarios />} />
          <Route path="/usuarios/novo" element={<FormularioUsuario />} />
          <Route path="/usuarios/:id/editar" element={<FormularioUsuario />} />
          <Route path="/campanhas" element={<ListaCampanhas />} />
          <Route path="/campanhas/nova" element={<NovaCampanha />} />
          <Route path="/campanhas/grupos" element={<GruposEnvio />} />
          {usuario.papel === 'admin' && (
            <Route path="/setup" element={<Setup />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/setup/condicoes" element={<Condicoes />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/marcas" element={<Marcas />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/categorias" element={<Categorias />} />
          )}
        </Routes>
      </main>
    </div>
  )
}

export default App
