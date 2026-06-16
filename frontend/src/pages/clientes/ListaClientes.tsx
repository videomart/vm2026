import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { Paginacao } from '../../components/Paginacao'
import { formatarCNPJCPF, formatarTelefone } from '../../utils/formatar'
import type { Cliente } from './types'

export function ListaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(clientes, 'razao_social')

  function carregar() {
    setCarregando(true)
    setErro(null)
    const parametros = new URLSearchParams()
    if (busca.trim()) parametros.set('q', busca.trim())
    if (mostrarInativos) parametros.set('incluirInativos', '1')
    fetch(`/api/clientes?${parametros.toString()}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => { setClientes(data.clientes); grid.resetar() })
      .catch(() => setErro('Não foi possível carregar os clientes.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [mostrarInativos]) // eslint-disable-line react-hooks/exhaustive-deps

  async function inativar(cliente: Cliente) {
    if (!confirm(`Inativar o cliente "${cliente.razao_social}"?`)) return
    const res = await fetch(`/api/clientes/${cliente.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) carregar()
  }

  async function reativar(cliente: Cliente) {
    const res = await fetch(`/api/clientes/${cliente.id}/reativar`, { method: 'POST', credentials: 'include' })
    if (res.ok) carregar()
  }

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Clientes</h2>
        <Link className="botao" to="/clientes/novo">+ Novo cliente</Link>
      </div>

      <form className="barra-busca" onSubmit={(e) => { e.preventDefault(); carregar() }}>
        <input
          type="search"
          placeholder="Buscar por razão social, fantasia ou CNPJ/CPF"
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

      <div className="tabela-wrapper">
        {carregando && <p className="estado-vazio">Carregando...</p>}
        {!carregando && clientes.length === 0 && <p className="estado-vazio">Nenhum cliente encontrado.</p>}
        {!carregando && clientes.length > 0 && (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th {...grid.th('razao_social')}>Razão social</th>
                  <th {...grid.th('nome_fantasia')}>Nome fantasia</th>
                  <th {...grid.th('cnpj_cpf')}>CNPJ/CPF</th>
                  <th {...grid.th('telefone')}>Telefone</th>
                  <th {...grid.th('cidade')}>Cidade/UF</th>
                  <th {...grid.th('ativo')}>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grid.pagina_atual.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.razao_social}</td>
                    <td>{cliente.nome_fantasia ?? '—'}</td>
                    <td>{cliente.cnpj_cpf ? formatarCNPJCPF(cliente.cnpj_cpf) : '—'}</td>
                    <td>{cliente.telefone ? formatarTelefone(cliente.telefone) : '—'}</td>
                    <td>{cliente.cidade ?? '—'}{cliente.uf ? `/${cliente.uf}` : ''}</td>
                    <td>
                      {cliente.ativo
                        ? <span className="badge badge-ativo">Ativo</span>
                        : <span className="badge badge-inativo">Inativo</span>}
                    </td>
                    <td>
                      <div className="acoes">
                        <Link className="botao-link" to={`/clientes/${cliente.id}/editar`}>Editar</Link>
                        {cliente.ativo
                          ? <button className="botao-perigo" type="button" onClick={() => inativar(cliente)}>Inativar</button>
                          : <button className="botao-secundario" type="button" onClick={() => reativar(cliente)}>Reativar</button>}
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
    </section>
  )
}
