import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { useOverflowHorizontal } from '../../hooks/useOverflowHorizontal'
import { Paginacao } from '../../components/Paginacao'

type Indicador = {
  id: number
  nome: string
  email: string
  empresa: string | null
  telefone: string | null
  slug: string
  preferencia_recompensa: 'comissao' | 'credito'
  ativo: number
  criado_em: string
  total_leads: number
  total_convertidos: number
}

const LINK_BASE = 'https://avideomart.com.br/?ref='

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR')
}

export function ListaIndicadores() {
  const [indicadores, setIndicadores] = useState<Indicador[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<number | null>(null)

  const grid = useGrid(indicadores, 'id', 30, 'desc')
  const { ref: wrapperRef, temOverflow } = useOverflowHorizontal<HTMLDivElement>()

  function carregar() {
    setCarregando(true)
    setErro(null)
    fetch('/api/indicadores', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { setIndicadores(d.indicadores); grid.resetar() })
      .catch(() => setErro('Não foi possível carregar os indicadores.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function alternarAtivo(ind: Indicador) {
    const novoAtivo = !ind.ativo
    await fetch(`/api/indicadores/${ind.id}/ativo`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: novoAtivo }),
    })
    setIndicadores((prev) => prev.map((i) => i.id === ind.id ? { ...i, ativo: novoAtivo ? 1 : 0 } : i))
  }

  async function copiarLink(ind: Indicador) {
    const link = `${LINK_BASE}${ind.slug}`
    await navigator.clipboard.writeText(link)
    setCopiado(ind.id)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Indicadores</h2>
      </div>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {temOverflow && (
        <p style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '6px' }}>
          ⇆ Role a tabela para o lado para ver todas as colunas e ações.
        </p>
      )}

      <div className="tabela-wrapper" ref={wrapperRef}>
        {carregando && <p className="estado-vazio">Carregando...</p>}
        {!carregando && indicadores.length === 0 && <p className="estado-vazio">Nenhum indicador cadastrado.</p>}
        {!carregando && indicadores.length > 0 && (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th {...grid.th('nome')}>Nome</th>
                  <th {...grid.th('empresa')}>Empresa</th>
                  <th>E-mail</th>
                  <th>Link de indicação</th>
                  <th {...grid.th('preferencia_recompensa')}>Preferência</th>
                  <th {...grid.th('total_leads')} style={{ textAlign: 'center' }}>Leads</th>
                  <th {...grid.th('total_convertidos')} style={{ textAlign: 'center' }}>Convertidos</th>
                  <th {...grid.th('ativo')} style={{ textAlign: 'center' }}>Status</th>
                  <th {...grid.th('criado_em')}>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grid.pagina_atual.map((ind) => (
                  <tr key={ind.id}>
                    <td>
                      <Link className="botao-link" to={`/indicadores/${ind.id}`}>{ind.nome}</Link>
                    </td>
                    <td>{ind.empresa ?? '—'}</td>
                    <td style={{ fontSize: '0.9em' }}>{ind.email}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.85em', color: 'var(--text-muted, var(--text))' }}>
                          {ind.slug}
                        </span>
                        <button
                          className="botao-secundario"
                          type="button"
                          style={{ padding: '2px 8px', fontSize: '0.8em', whiteSpace: 'nowrap' }}
                          onClick={() => copiarLink(ind)}
                          title={`${LINK_BASE}${ind.slug}`}
                        >
                          {copiado === ind.id ? 'Copiado!' : 'Copiar link'}
                        </button>
                      </div>
                    </td>
                    <td>{ind.preferencia_recompensa === 'comissao' ? 'Comissão' : 'Crédito'}</td>
                    <td style={{ textAlign: 'center' }}>{ind.total_leads}</td>
                    <td style={{ textAlign: 'center' }}>{ind.total_convertidos}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={ind.ativo ? 'badge badge-ativo' : 'badge badge-inativo'}>
                        {ind.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>{formatarData(ind.criado_em)}</td>
                    <td>
                      <div className="acoes">
                        <Link className="botao-link" to={`/indicadores/${ind.id}`}>Ver</Link>
                        <button
                          className={ind.ativo ? 'botao-secundario' : 'botao'}
                          type="button"
                          onClick={() => alternarAtivo(ind)}
                        >
                          {ind.ativo ? 'Desativar' : 'Ativar'}
                        </button>
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
