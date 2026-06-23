import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Login } from './pages/Login'
import type { Usuario } from './pages/Login'
import { EsqueciSenha } from './pages/EsqueciSenha'
import { RedefinirSenha } from './pages/RedefinirSenha'
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
import { ContasSmtp } from './pages/setup/ContasSmtp'
import { Marcas } from './pages/setup/Marcas'
import { Categorias } from './pages/setup/Categorias'
import { CategoriasCliente } from './pages/setup/CategoriasCliente'
import { ListaCampanhas } from './pages/campanhas/ListaCampanhas'
import { DetalheCampanha } from './pages/campanhas/DetalheCampanha'
import { NovaCampanha } from './pages/campanhas/NovaCampanha'
import { GruposEnvio } from './pages/campanhas/GruposEnvio'
import { TemplatesEmail } from './pages/campanhas/TemplatesEmail'
import { ListaContasReceber } from './pages/contasReceber/ListaContasReceber'
import { ListaAssinaturas } from './pages/contasReceber/ListaAssinaturas'
import { RelatorioContasReceber } from './pages/contasReceber/RelatorioContasReceber'
import { ImpressaoRelatorioContasReceber } from './pages/contasReceber/ImpressaoRelatorioContasReceber'
import { ListaContasPagar } from './pages/contasPagar/ListaContasPagar'
import { DespesasRecorrentes } from './pages/contasPagar/DespesasRecorrentes'
import { Fornecedores } from './pages/contasPagar/Fornecedores'
import { CategoriasDespesa } from './pages/contasPagar/CategoriasDespesa'
import { ContasFinanceiras } from './pages/contasPagar/ContasFinanceiras'
import { CotacaoDolar } from './pages/contasPagar/CotacaoDolar'
import { RelatorioContasPagar } from './pages/contasPagar/RelatorioContasPagar'
import { ImpressaoRelatorioContasPagar } from './pages/contasPagar/ImpressaoRelatorioContasPagar'
import { LogoEmpresa } from './components/LogoEmpresa'

type SessaoStatus = 'verificando' | 'deslogado' | 'logado'

const ITEM_NAV = ({ isActive }: { isActive: boolean }) => (isActive ? 'ativo' : '')

const ROTAS_CONFIG = ['/setup', '/usuarios', '/marcas', '/categorias', '/categorias-cliente', '/contas-smtp']
const ROTAS_FINANCEIRO = ['/contas-receber', '/contas-pagar', '/fornecedores', '/categorias-despesa', '/contas-financeiras', '/cotacao-dolar']

function App() {
  const [status, setStatus] = useState<SessaoStatus>('verificando')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const location = useLocation()
  const emConfig = ROTAS_CONFIG.some((r) => location.pathname.startsWith(r))
  const emFinanceiro = ROTAS_FINANCEIRO.some((r) => location.pathname.startsWith(r))
  const [configAberto, setConfigAberto] = useState(emConfig)
  const [financeiroAberto, setFinanceiroAberto] = useState(emFinanceiro)

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
    if (location.pathname === '/esqueci-senha') return <EsqueciSenha />
    if (location.pathname === '/redefinir-senha') return <RedefinirSenha />
    return <Login onLogin={handleLogin} />
  }

  if (location.pathname.endsWith('/imprimir')) {
    return (
      <Routes>
        <Route path="/propostas/:id/imprimir" element={<ImpressaoProposta />} />
        <Route path="/contas-receber/relatorio/imprimir" element={<ImpressaoRelatorioContasReceber />} />
        <Route path="/contas-pagar/relatorio/imprimir" element={<ImpressaoRelatorioContasPagar />} />
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
        <span className="topo-mobile-titulo"><LogoEmpresa />vm2026</span>
      </header>

      {menuAberto && <div className="overlay-menu" onClick={() => setMenuAberto(false)} />}

      <aside className={`barra-lateral${menuAberto ? ' aberta' : ''}`}>
        <div className="barra-lateral-topo">
          <h1><LogoEmpresa />vm2026</h1>
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
          <button
            className={`menu-grupo-btn${emFinanceiro ? ' ativo' : ''}`}
            type="button"
            onClick={() => setFinanceiroAberto((v) => !v)}
          >
            <span>Financeiro</span>
            <span className="menu-grupo-seta">{financeiroAberto ? '▾' : '▸'}</span>
          </button>
          {financeiroAberto && (
            <div className="menu-subgrupo">
              <NavLink to="/contas-receber" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Contas a receber</NavLink>
              <NavLink to="/contas-receber/relatorio" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Relatório de recebíveis</NavLink>
              <NavLink to="/contas-pagar" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Contas a pagar</NavLink>
              <NavLink to="/contas-pagar/relatorio" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Relatório de despesas</NavLink>
              <NavLink to="/fornecedores" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Fornecedores</NavLink>
              <NavLink to="/categorias-despesa" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Categorias de despesa</NavLink>
              <NavLink to="/contas-financeiras" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Contas financeiras</NavLink>
              <NavLink to="/cotacao-dolar" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Cotação do dólar</NavLink>
            </div>
          )}
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
                  <NavLink to="/categorias-cliente" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Categorias de cliente</NavLink>
                  <NavLink to="/contas-smtp" className={ITEM_NAV} onClick={() => setMenuAberto(false)}>Contas SMTP</NavLink>
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
          <span className="versao-app" title="Versão/release do build atual">v{__APP_BUILD__} · {__BUILD_TIME__}</span>
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
          <Route path="/contas-receber" element={<ListaContasReceber />} />
          <Route path="/contas-receber/assinaturas" element={<ListaAssinaturas />} />
          <Route path="/contas-receber/relatorio" element={<RelatorioContasReceber />} />
          <Route path="/contas-pagar" element={<ListaContasPagar />} />
          <Route path="/contas-pagar/recorrentes" element={<DespesasRecorrentes />} />
          <Route path="/contas-pagar/relatorio" element={<RelatorioContasPagar />} />
          <Route path="/leads" element={<ListaLeads />} />
          <Route path="/leads/novo" element={<FormularioLead />} />
          <Route path="/leads/:id" element={<FormularioLead />} />
          <Route path="/usuarios" element={<ListaUsuarios />} />
          <Route path="/usuarios/novo" element={<FormularioUsuario />} />
          <Route path="/usuarios/:id/editar" element={<FormularioUsuario />} />
          <Route path="/campanhas" element={<ListaCampanhas />} />
          <Route path="/campanhas/nova" element={<NovaCampanha />} />
          <Route path="/campanhas/grupos" element={<GruposEnvio />} />
          <Route path="/campanhas/templates" element={<TemplatesEmail />} />
          <Route path="/campanhas/:id" element={<DetalheCampanha />} />
          {usuario.papel === 'admin' && (
            <Route path="/setup" element={<Setup />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/setup/condicoes" element={<Condicoes />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/contas-smtp" element={<ContasSmtp />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/marcas" element={<Marcas />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/categorias" element={<Categorias />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/categorias-cliente" element={<CategoriasCliente />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/fornecedores" element={<Fornecedores />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/categorias-despesa" element={<CategoriasDespesa />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/contas-financeiras" element={<ContasFinanceiras />} />
          )}
          {usuario.papel === 'admin' && (
            <Route path="/cotacao-dolar" element={<CotacaoDolar />} />
          )}
        </Routes>
      </main>
    </div>
  )
}

export default App
