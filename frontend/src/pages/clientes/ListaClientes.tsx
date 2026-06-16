import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrdenacao } from '../../hooks/useOrdenacao'
import type { Cliente } from './types'

export function ListaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const { ordenados, props: th } = useOrdenacao(clientes, 'razao_social')

  function carregar() {
    setCarregando(true)
    setErro(null)

    const parametros = new URLSearchParams()
    if (busca.trim()) parametros.set('q', busca.trim())
    if (mostrarInativos) parametros.set('incluirInativos', '1')

    fetch(`/api/clientes?${parametros.toString()}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setClientes(data.clientes))
      .catch(() => setErro('Não foi possível carregar os clientes.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarInativos])

  function handleBusca(event: React.FormEvent) {
    event.preventDefault()
    carregar()
  }

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

      <form className="barra-busca" onSubmit={handleBusca}>
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
          <table className="tabela">
            <thead>
              <tr>
                <th {...th('razao_social')}>Razão social</th>
                <th {...th('nome_fantasia')}>Nome fantasia</th>
                <th {...th('cnpj_cpf')}>CNPJ/CPF</th>
                <th {...th('cidade')}>Cidade/UF</th>
                <th {...th('ativo')}>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((cliente) => (
                <tr key={cliente.id}>
                  <td>{cliente.razao_social}</td>
                  <td>{cliente.nome_fantasia ?? '—'}</td>
                  <td>{cliente.cnpj_cpf ?? '—'}</td>
                  <td>
                    {cliente.cidade ?? '—'}
                    {cliente.uf ? `/${cliente.uf}` : ''}
                  </td>
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
        )}
      </div>
    </section>
  )
}
