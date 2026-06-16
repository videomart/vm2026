import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { Paginacao } from '../../components/Paginacao'
import { formatarMoeda } from '../../utils/formatar'
import type { Proposta, StatusProposta } from './types'

const LABELS_STATUS: Record<StatusProposta, string> = {
  aberta: 'Aberta',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  convertida: 'Convertida',
}

const CLASSES_STATUS: Record<StatusProposta, string> = {
  aberta: 'badge badge-ativo',
  aprovada: 'badge badge-sucesso',
  recusada: 'badge badge-inativo',
  convertida: 'badge badge-convertida',
}

function formatarData(data: string) {
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function ListaPropostas() {
  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [filtroStatus, setFiltroStatus] = useState<StatusProposta | ''>('')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(propostas, 'data')

  function carregar() {
    setCarregando(true)
    setErro(null)
    const params = new URLSearchParams()
    if (filtroStatus) params.set('status', filtroStatus)
    if (busca.trim()) params.set('q', busca.trim())
    fetch(`/api/propostas?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { setPropostas(d.propostas); grid.resetar() })
      .catch(() => setErro('Não foi possível carregar as propostas.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [filtroStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Propostas</h2>
        <Link className="botao" to="/propostas/nova">+ Nova proposta</Link>
      </div>

      <form className="barra-busca" onSubmit={(e) => { e.preventDefault(); carregar() }}>
        <input
          type="search"
          placeholder="Buscar por cliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button className="botao-secundario" type="submit">Buscar</button>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusProposta | '')}
          style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--raio)', border: '1px solid var(--border)' }}
        >
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="aprovada">Aprovada</option>
          <option value="recusada">Recusada</option>
          <option value="convertida">Convertida</option>
        </select>
      </form>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div className="tabela-wrapper">
        {carregando && <p className="estado-vazio">Carregando...</p>}
        {!carregando && propostas.length === 0 && <p className="estado-vazio">Nenhuma proposta encontrada.</p>}
        {!carregando && propostas.length > 0 && (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th {...grid.th('id')}>#</th>
                  <th {...grid.th('cliente_nome')}>Cliente</th>
                  <th {...grid.th('vendedor_nome')}>Vendedor</th>
                  <th {...grid.th('data')}>Data</th>
                  <th {...grid.th('validade')}>Validade</th>
                  <th {...grid.th('total')}>Total</th>
                  <th {...grid.th('status')}>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {grid.pagina_atual.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.cliente_nome}</td>
                    <td>{p.vendedor_nome}</td>
                    <td>{formatarData(p.data)}</td>
                    <td>{p.validade ? formatarData(p.validade) : '—'}</td>
                    <td>{formatarMoeda(p.total)}</td>
                    <td><span className={CLASSES_STATUS[p.status]}>{LABELS_STATUS[p.status]}</span></td>
                    <td>
                      <div className="acoes">
                        <Link className="botao-link" to={`/propostas/${p.id}`}>
                          {p.status === 'aberta' ? 'Editar' : 'Ver'}
                        </Link>
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
