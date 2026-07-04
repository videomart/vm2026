import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

type Indicador = {
  id: number
  nome: string
  email: string
  empresa: string | null
  telefone: string | null
  cpf_cnpj: string | null
  slug: string
  preferencia_recompensa: 'comissao' | 'credito'
  ativo: number
  criado_em: string
}

type LeadIndicado = {
  id: number
  contato: string | null
  nome_empresa: string | null
  email: string | null
  status: string
  criado_em: string
}

const LABELS_STATUS: Record<string, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  convertido: 'Convertido',
  descartado: 'Descartado',
}

const CLASSES_STATUS: Record<string, string> = {
  novo: 'badge badge-ativo',
  em_contato: 'badge badge-convertida',
  convertido: 'badge badge-sucesso',
  descartado: 'badge badge-inativo',
}

const LINK_BASE = 'https://avideomart.com.br/?ref='

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR')
}

export function DetalheIndicador() {
  const { id } = useParams()
  const [indicador, setIndicador] = useState<Indicador | null>(null)
  const [leads, setLeads] = useState<LeadIndicado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    fetch(`/api/indicadores/${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { setIndicador(d.indicador); setLeads(d.leads) })
      .catch(() => setErro('Não foi possível carregar o indicador.'))
      .finally(() => setCarregando(false))
  }, [id])

  async function copiarLink() {
    if (!indicador) return
    await navigator.clipboard.writeText(`${LINK_BASE}${indicador.slug}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (carregando) return <section><p className="estado-vazio">Carregando...</p></section>
  if (erro) return <section><p className="alerta-erro">{erro}</p></section>
  if (!indicador) return <section><p className="estado-vazio">Indicador não encontrado.</p></section>

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Indicador — {indicador.nome}</h2>
        <Link className="botao-secundario" to="/indicadores">← Voltar</Link>
      </div>

      <div className="card-form" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          <div>
            <strong>Nome</strong>
            <p>{indicador.nome}</p>
          </div>
          <div>
            <strong>E-mail</strong>
            <p>{indicador.email}</p>
          </div>
          <div>
            <strong>Empresa</strong>
            <p>{indicador.empresa ?? '—'}</p>
          </div>
          <div>
            <strong>Telefone</strong>
            <p>{indicador.telefone ?? '—'}</p>
          </div>
          <div>
            <strong>CPF / CNPJ</strong>
            <p>{indicador.cpf_cnpj ?? '—'}</p>
          </div>
          <div>
            <strong>Preferência de recompensa</strong>
            <p>{indicador.preferencia_recompensa === 'comissao' ? 'Comissão sobre a venda' : 'Crédito em serviços Videomart'}</p>
          </div>
          <div>
            <strong>Status</strong>
            <p>
              <span className={indicador.ativo ? 'badge badge-ativo' : 'badge badge-inativo'}>
                {indicador.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </p>
          </div>
          <div>
            <strong>Cadastrado em</strong>
            <p>{formatarData(indicador.criado_em)}</p>
          </div>
        </div>

        <div style={{ marginTop: '1.2rem' }}>
          <strong>Link de indicação</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <code style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--raio)',
              padding: '6px 10px',
              fontSize: '0.9em',
              flex: 1,
              wordBreak: 'break-all',
            }}>
              {LINK_BASE}{indicador.slug}
            </code>
            <button className="botao-secundario" type="button" onClick={copiarLink}>
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1rem' }}>
        Leads indicados ({leads.length})
      </h3>

      {leads.length === 0 ? (
        <p className="estado-vazio">Nenhum lead vindo deste indicador ainda.</p>
      ) : (
        <div className="tabela-wrapper">
          <table className="tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Empresa / Contato</th>
                <th>E-mail</th>
                <th>Status</th>
                <th>Recebido em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>
                    {l.nome_empresa ?? '—'}
                    {l.contato && <div style={{ fontSize: '0.85em', color: 'var(--text)' }}>{l.contato}</div>}
                  </td>
                  <td style={{ fontSize: '0.9em' }}>{l.email ?? '—'}</td>
                  <td>
                    <span className={CLASSES_STATUS[l.status] ?? 'badge'}>
                      {LABELS_STATUS[l.status] ?? l.status}
                    </span>
                  </td>
                  <td>{formatarData(l.criado_em)}</td>
                  <td>
                    <Link className="botao-link" to={`/leads/${l.id}`}>Ver lead</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
