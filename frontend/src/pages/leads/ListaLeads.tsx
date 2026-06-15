import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Lead, StatusLead } from './types'

const LABELS_STATUS: Record<StatusLead, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  convertido: 'Convertido',
  descartado: 'Descartado',
}

const CLASSES_STATUS: Record<StatusLead, string> = {
  novo: 'badge badge-ativo',
  em_contato: 'badge badge-convertida',
  convertido: 'badge badge-sucesso',
  descartado: 'badge badge-inativo',
}

function formatarData(data: string) {
  return new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function ListaLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [usuarioId, setUsuarioId] = useState<number | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<StatusLead | ''>('novo')
  const [meusLeads, setMeusLeads] = useState(false)
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUsuarioId(d?.usuario?.id ?? null))
      .catch(() => {})
  }, [])

  function carregar() {
    setCarregando(true)
    setErro(null)
    const params = new URLSearchParams()
    if (filtroStatus) params.set('status', filtroStatus)
    if (busca.trim()) params.set('q', busca.trim())
    if (meusLeads && usuarioId) params.set('vendedorId', String(usuarioId))

    fetch(`/api/leads?${params}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setLeads(d.leads))
      .catch(() => setErro('Não foi possível carregar os leads.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [filtroStatus, meusLeads, usuarioId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function assumir(lead: Lead) {
    const res = await fetch(`/api/leads/${lead.id}/assumir`, { method: 'POST', credentials: 'include' })
    if (res.ok) carregar()
  }

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Leads</h2>
        <Link className="botao" to="/leads/novo">
          + Novo lead
        </Link>
      </div>

      <form className="barra-busca" onSubmit={(e) => { e.preventDefault(); carregar() }}>
        <input
          type="search"
          placeholder="Buscar por empresa, contato ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button className="botao-secundario" type="submit">Buscar</button>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusLead | '')}
          style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--raio)', border: '1px solid var(--border)' }}
        >
          <option value="">Todos os status</option>
          <option value="novo">Novo</option>
          <option value="em_contato">Em contato</option>
          <option value="convertido">Convertido</option>
          <option value="descartado">Descartado</option>
        </select>
        <label className="opcao-checkbox">
          <input type="checkbox" checked={meusLeads} onChange={(e) => setMeusLeads(e.target.checked)} />
          Meus leads
        </label>
      </form>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div className="tabela-wrapper">
        {carregando && <p className="estado-vazio">Carregando...</p>}
        {!carregando && leads.length === 0 && <p className="estado-vazio">Nenhum lead encontrado.</p>}
        {!carregando && leads.length > 0 && (
          <table className="tabela">
            <thead>
              <tr>
                <th>Empresa / Contato</th>
                <th>Telefone / E-mail</th>
                <th>Cidade/UF</th>
                <th>Origem</th>
                <th>Vendedor</th>
                <th>Status</th>
                <th>Recebido em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.nome_empresa ?? '—'}
                    {l.contato && <div style={{ fontSize: '0.85em', color: 'var(--text)' }}>{l.contato}</div>}
                  </td>
                  <td>
                    {l.telefone ?? '—'}
                    {l.email && <div style={{ fontSize: '0.85em', color: 'var(--text)' }}>{l.email}</div>}
                  </td>
                  <td>
                    {l.cidade ?? '—'}
                    {l.uf ? `/${l.uf}` : ''}
                  </td>
                  <td>{l.origem ?? '—'}</td>
                  <td>{l.vendedor_nome ?? '—'}</td>
                  <td><span className={CLASSES_STATUS[l.status]}>{LABELS_STATUS[l.status]}</span></td>
                  <td>{formatarData(l.criado_em)}</td>
                  <td>
                    <div className="acoes">
                      <Link className="botao-link" to={`/leads/${l.id}`}>Ver</Link>
                      {!l.vendedor_id && (
                        <button className="botao-secundario" type="button" onClick={() => assumir(l)}>
                          Assumir
                        </button>
                      )}
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
