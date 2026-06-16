import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { Paginacao } from '../../components/Paginacao'
import { formatarMoeda } from '../../utils/formatar'
import { salvarNavegacao } from '../../hooks/useNavegacaoRegistro'
import type { Produto } from './types'

export function ListaProdutos() {
  const navigate = useNavigate()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(produtos, 'modelo')

  function editarProduto(id: number) {
    salvarNavegacao('nav_produtos', grid.ordenados.map((p) => p.id))
    navigate(`/produtos/${id}/editar`)
  }

  function carregar() {
    setCarregando(true)
    setErro(null)
    const parametros = new URLSearchParams()
    if (busca.trim()) parametros.set('q', busca.trim())
    if (mostrarInativos) parametros.set('incluirInativos', '1')
    fetch(`/api/produtos?${parametros.toString()}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => { setProdutos(data.produtos); grid.resetar() })
      .catch(() => setErro('Não foi possível carregar os produtos.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [mostrarInativos]) // eslint-disable-line react-hooks/exhaustive-deps

  async function inativar(produto: Produto) {
    if (!confirm(`Inativar o produto "${produto.modelo}"?`)) return
    const res = await fetch(`/api/produtos/${produto.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) carregar()
  }

  async function reativar(produto: Produto) {
    const res = await fetch(`/api/produtos/${produto.id}/reativar`, { method: 'POST', credentials: 'include' })
    if (res.ok) carregar()
  }

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Produtos</h2>
        <Link className="botao" to="/produtos/novo">+ Novo produto</Link>
      </div>

      <form className="barra-busca" onSubmit={(e) => { e.preventDefault(); carregar() }}>
        <input
          type="search"
          placeholder="Buscar por modelo, descrição, marca ou categoria"
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
        {!carregando && produtos.length === 0 && <p className="estado-vazio">Nenhum produto encontrado.</p>}
        {!carregando && produtos.length > 0 && (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th {...grid.th('modelo')}>Modelo</th>
                  <th {...grid.th('marca')}>Marca</th>
                  <th {...grid.th('categoria')}>Categoria</th>
                  <th {...grid.th('preco_venda')}>Preço de venda</th>
                  <th {...grid.th('ativo')}>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grid.pagina_atual.map((produto) => (
                  <tr key={produto.id}>
                    <td>
                      <div>{produto.modelo}</div>
                      {produto.descricao && (
                        <small style={{ color: 'var(--text-h)', opacity: 0.7 }}>{produto.descricao}</small>
                      )}
                    </td>
                    <td>{produto.marca ?? '—'}</td>
                    <td>{produto.categoria ?? '—'}</td>
                    <td>{formatarMoeda(produto.preco_venda)}</td>
                    <td>
                      {produto.ativo
                        ? <span className="badge badge-ativo">Ativo</span>
                        : <span className="badge badge-inativo">Inativo</span>}
                    </td>
                    <td>
                      <div className="acoes">
                        <button className="botao-link" type="button" onClick={() => editarProduto(produto.id)}>Editar</button>
                        {produto.ativo
                          ? <button className="botao-perigo" type="button" onClick={() => inativar(produto)}>Inativar</button>
                          : <button className="botao-secundario" type="button" onClick={() => reativar(produto)}>Reativar</button>}
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
