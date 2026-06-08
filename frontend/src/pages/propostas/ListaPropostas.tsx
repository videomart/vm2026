import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

function formatarValor(valor: string) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

  function carregar() {
    setCarregando(true)
    setErro(null)
    const params = new URLSearchParams()
    if (filtroStatus) params.set('status', filtroStatus)
    if (busca.trim()) params.set('q', busca.trim())

    fetch(`/api/propostas?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setPropostas(d.propostas))
      .catch(() => setErro('Não foi possível carregar as propostas.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [filtroStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Propostas</h2>
        <Link className="botao" to="/propostas/nova">
          + Nova proposta
        </Link>
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
          <table className="tabela">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Data</th>
                <th>Validade</th>
                <th>Total</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.cliente_nome}</td>
                  <td>{p.vendedor_nome}</td>
                  <td>{formatarData(p.data)}</td>
                  <td>{p.validade ? formatarData(p.validade) : '—'}</td>
                  <td>{formatarValor(p.total)}</td>
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
        )}
      </div>
    </section>
  )
}
