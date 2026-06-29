import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { useBuscaDebounced } from '../../hooks/useBuscaDebounced'
import { Paginacao } from '../../components/Paginacao'
import { formatarMoeda, formatarData } from '../../utils/formatar'
import type { Oportunidade, ResumoStatus, StatusOportunidade } from './types'

const LABELS_STATUS: Record<StatusOportunidade, string> = {
  prospeccao: 'Prospecção',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
  ganha: 'Ganha',
  perdida: 'Perdida',
  pos_venda: 'Pós-venda',
}

const CLASSES_STATUS: Record<StatusOportunidade, string> = {
  prospeccao: 'badge badge-ativo',
  proposta_enviada: 'badge badge-convertida',
  negociacao: 'badge badge-convertida',
  ganha: 'badge badge-sucesso',
  perdida: 'badge badge-inativo',
  pos_venda: 'badge badge-sucesso',
}

export function ListaOportunidades() {
  const navigate = useNavigate()
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [resumo, setResumo] = useState<ResumoStatus[]>([])
  const [filtroStatus, setFiltroStatus] = useState<StatusOportunidade | ''>('')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(oportunidades, 'id', 30, 'desc')
  const buscaDebounced = useBuscaDebounced(busca)

  function carregar() {
    setCarregando(true)
    setErro(null)
    const params = new URLSearchParams()
    if (filtroStatus) params.set('status', filtroStatus)
    if (buscaDebounced.trim()) params.set('q', buscaDebounced.trim())
    Promise.all([
      fetch(`/api/oportunidades?${params}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch('/api/oportunidades/resumo', { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
    ])
      .then(([d, dr]) => { setOportunidades(d.oportunidades); setResumo(dr.resumo ?? []); grid.resetar() })
      .catch(() => setErro('Não foi possível carregar as oportunidades.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [buscaDebounced, filtroStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  function totalPorStatus(status: StatusOportunidade): number {
    return resumo.find((r) => r.status === status)?.total ?? 0
  }

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Oportunidades</h2>
        <Link className="botao" to="/oportunidades/nova">+ Nova oportunidade</Link>
      </div>

      <div className="cards-resumo" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(Object.keys(LABELS_STATUS) as StatusOportunidade[]).map((status) => (
          <button
            key={status}
            type="button"
            className={filtroStatus === status ? 'botao-secundario' : 'botao-link'}
            onClick={() => setFiltroStatus(filtroStatus === status ? '' : status)}
            style={{ border: '1px solid var(--border)', borderRadius: 'var(--raio)', padding: '0.5rem 0.8rem', textAlign: 'left' }}
          >
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{totalPorStatus(status)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{LABELS_STATUS[status]}</div>
          </button>
        ))}
      </div>

      <form className="barra-busca" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          placeholder="Buscar por título ou cliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value.toUpperCase())}
        />
      </form>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div className="tabela-wrapper">
        {carregando && <p className="estado-vazio">Carregando...</p>}
        {!carregando && oportunidades.length === 0 && <p className="estado-vazio">Nenhuma oportunidade encontrada.</p>}
        {!carregando && oportunidades.length > 0 && (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th {...grid.th('id')}>#</th>
                  <th {...grid.th('titulo')}>Título / Cliente</th>
                  <th {...grid.th('vendedor_nome')}>Vendedor</th>
                  <th {...grid.th('valor_estimado')}>Valor estimado</th>
                  <th {...grid.th('status')}>Status</th>
                  <th {...grid.th('criado_em')}>Criada em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grid.pagina_atual.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>
                      {o.titulo}
                      {o.cliente_nome && o.cliente_nome !== o.titulo && (
                        <div style={{ fontSize: '0.85em', color: 'var(--text)' }}>{o.cliente_nome}</div>
                      )}
                    </td>
                    <td>{o.vendedor_nome ?? '—'}</td>
                    <td>{o.valor_estimado ? formatarMoeda(o.valor_estimado) : '—'}</td>
                    <td><span className={CLASSES_STATUS[o.status]}>{LABELS_STATUS[o.status]}</span></td>
                    <td>{formatarData(o.criado_em)}</td>
                    <td>
                      <button className="botao-link" type="button" onClick={() => navigate(`/oportunidades/${o.id}`)}>Ver</button>
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
