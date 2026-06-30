import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGrid } from '../../hooks/useGrid'
import { useOverflowHorizontal } from '../../hooks/useOverflowHorizontal'
import { Paginacao } from '../../components/Paginacao'
import { formatarTelefone } from '../../utils/formatar'
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

// SLA: lead "novo" sem vendedor designado há mais de 24h fica em risco de
// perder a janela de contato rápido (que converte melhor) — destaque visual
// para não passar batido no grid.
const SLA_HORAS = 24
function estaAtrasado(lead: Lead): boolean {
  if (lead.status !== 'novo' || lead.vendedor_id) return false
  const horasDesdeRecebido = (Date.now() - new Date(lead.criado_em).getTime()) / 3600000
  return horasDesdeRecebido > SLA_HORAS
}

export function ListaLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [usuarioId, setUsuarioId] = useState<number | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<StatusLead | ''>('')
  const [meusLeads, setMeusLeads] = useState(false)
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())

  const grid = useGrid(leads, 'id', 30, 'desc')
  const { ref: wrapperRef, temOverflow } = useOverflowHorizontal<HTMLDivElement>()

  const idsNaPagina = grid.pagina_atual.map((l) => l.id)
  const todosNaPaginaSelecionados = idsNaPagina.length > 0 && idsNaPagina.every((id) => selecionados.has(id))

  function alternarSelecao(id: number) {
    setSelecionados((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function alternarSelecaoPagina() {
    setSelecionados((prev) => {
      const novo = new Set(prev)
      if (todosNaPaginaSelecionados) {
        idsNaPagina.forEach((id) => novo.delete(id))
      } else {
        idsNaPagina.forEach((id) => novo.add(id))
      }
      return novo
    })
  }

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
      .then((d) => { setLeads(d.leads); grid.resetar(); setSelecionados(new Set()) })
      .catch(() => setErro('Não foi possível carregar os leads.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [filtroStatus, meusLeads, usuarioId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function assumir(lead: Lead) {
    const res = await fetch(`/api/leads/${lead.id}/assumir`, { method: 'POST', credentials: 'include' })
    if (res.ok) carregar()
  }

  async function remover(lead: Lead) {
    if (!confirm(`Remover o lead "${lead.nome_empresa ?? lead.contato ?? lead.id}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) carregar()
  }

  async function removerSelecionados() {
    const total = selecionados.size
    if (!total) return
    if (!confirm(`Remover ${total} lead(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return
    const res = await fetch('/api/leads', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selecionados) }),
    })
    if (res.ok) carregar()
    else {
      const d = await res.json().catch(() => null)
      alert(d?.erro ?? 'Erro ao remover leads selecionados.')
    }
  }

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Leads</h2>
        <Link className="botao" to="/leads/novo">+ Novo lead</Link>
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
        {selecionados.size > 0 && (
          <button className="botao-perigo" type="button" onClick={removerSelecionados}>
            Excluir selecionados ({selecionados.size})
          </button>
        )}
      </form>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {temOverflow && (
        <p style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '6px' }}>
          ⇆ Role a tabela para o lado para ver todas as colunas e ações.
        </p>
      )}

      <div className="tabela-wrapper" ref={wrapperRef}>
        {carregando && <p className="estado-vazio">Carregando...</p>}
        {!carregando && leads.length === 0 && <p className="estado-vazio">Nenhum lead encontrado.</p>}
        {!carregando && leads.length > 0 && (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th {...grid.th('id')}>ID</th>
                  <th {...grid.th('nome_empresa')}>Empresa / Contato</th>
                  <th>Telefone / E-mail</th>
                  <th {...grid.th('cidade')}>Cidade/UF</th>
                  <th {...grid.th('vendedor_nome')}>Vendedor</th>
                  <th {...grid.th('status')}>Status</th>
                  <th {...grid.th('criado_em')}>Recebido em</th>
                  <th>Ações</th>
                  <th style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={todosNaPaginaSelecionados}
                      onChange={alternarSelecaoPagina}
                      title="Selecionar todos desta página"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {grid.pagina_atual.map((l) => (
                  <tr key={l.id} className={l.status === 'novo' || estaAtrasado(l) ? 'linha-atrasada' : ''}>
                    <td>{l.id}</td>
                    <td>
                      {l.nome_empresa ?? '—'}
                      {l.contato && <div style={{ fontSize: '0.85em', color: 'var(--text)' }}>{l.contato}</div>}
                    </td>
                    <td>
                      {l.telefone ? formatarTelefone(l.telefone) : '—'}
                      {l.email && <div style={{ fontSize: '0.85em', color: 'var(--text)' }}>{l.email}</div>}
                    </td>
                    <td>{l.cidade ?? '—'}{l.uf ? `/${l.uf}` : ''}</td>
                    <td>{l.vendedor_nome ?? '—'}</td>
                    <td>
                      <span className={CLASSES_STATUS[l.status]}>{LABELS_STATUS[l.status]}</span>
                      {estaAtrasado(l) && (
                        <span className="badge badge-inativo" style={{ marginLeft: '4px', background: 'var(--perigo-bg)', color: 'var(--perigo)' }} title={`Sem vendedor há mais de ${SLA_HORAS}h`}>
                          atrasado
                        </span>
                      )}
                    </td>
                    <td>{formatarData(l.criado_em)}</td>
                    <td>
                      <div className="acoes">
                        <Link className="botao-link" to={`/leads/${l.id}`}>Ver</Link>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button
                            className="botao-secundario"
                            type="button"
                            disabled={!!l.vendedor_id}
                            onClick={() => assumir(l)}
                          >
                            Assumir
                          </button>
                          <button className="botao-perigo" type="button" onClick={() => remover(l)}>Remover</button>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selecionados.has(l.id)}
                        onChange={() => alternarSelecao(l.id)}
                      />
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
