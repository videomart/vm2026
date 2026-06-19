import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatarData } from '../../utils/formatar'

type StatusEnvio = 'pendente' | 'enviado' | 'erro'

type Envio = {
  id: number
  email: string
  nome: string | null
  status: StatusEnvio
  mensagem_erro: string | null
  enviado_em: string | null
}

type Campanha = {
  id: number
  assunto: string
  corpo: string
  grupo_id: number
  grupo_nome: string
  enviado_em: string | null
  criado_em: string
  status_processamento: 'processando' | 'concluida' | 'erro' | null
  total_destinatarios: number | null
}

const LABEL_STATUS_ENVIO: Record<StatusEnvio, string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  erro: 'Erro',
}

const CLASSE_STATUS_ENVIO: Record<StatusEnvio, string> = {
  pendente: 'badge badge-ativo',
  enviado: 'badge badge-sucesso',
  erro: 'badge badge-inativo',
}

export function DetalheCampanha() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campanha, setCampanha] = useState<Campanha | null>(null)
  const [envios, setEnvios] = useState<Envio[]>([])
  const [filtroStatus, setFiltroStatus] = useState<StatusEnvio | ''>('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [retomando, setRetomando] = useState(false)
  const [errosDefinitivos, setErrosDefinitivos] = useState<Envio[]>([])
  const [sanitizando, setSanitizando] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  function carregar() {
    fetch(`/api/campanhas/${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { setCampanha(d.campanha); setEnvios(d.envios ?? []) })
      .catch(() => setErro('Não foi possível carregar a campanha.'))
      .finally(() => setCarregando(false))
    carregarErrosDefinitivos()
  }

  function carregarErrosDefinitivos() {
    fetch(`/api/campanhas/${id}/erros-definitivos`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setErrosDefinitivos(d.erros ?? []))
      .catch(() => {})
  }

  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const processando = campanha?.status_processamento === 'processando'
    if (processando && !pollTimer.current) {
      pollTimer.current = setInterval(carregar, 5000)
    } else if (!processando && pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    return () => {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null }
    }
  }, [campanha]) // eslint-disable-line react-hooks/exhaustive-deps

  if (carregando) return <p>Carregando...</p>
  if (erro) return <p className="alerta-erro" role="alert">{erro}</p>
  if (!campanha) return null

  const enviados = envios.filter((e) => e.status === 'enviado')
  const comErro = envios.filter((e) => e.status === 'erro')
  const pendentes = envios.filter((e) => e.status === 'pendente')

  const enviosFiltrados = filtroStatus ? envios.filter((e) => e.status === filtroStatus) : envios

  function copiarEmailsComErro() {
    const lista = comErro.map((e) => e.email).join(', ')
    navigator.clipboard.writeText(lista)
    alert(`${comErro.length} e-mail(s) com erro copiado(s) para a área de transferência.`)
  }

  async function sanitizar() {
    if (!confirm(
      `${errosDefinitivos.length} e-mail(s) com erro definitivo (endereço inexistente/rejeitado) serão removidos ` +
      `do grupo e marcados como inválidos no cadastro do cliente/contato (e-mail apagado, pendente de recadastro). ` +
      `Confirma?`,
    )) return
    setSanitizando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/campanhas/${id}/sanitizar`, { method: 'POST', credentials: 'include' })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao sanitizar e-mails.'); return }
      alert(
        `${d.total_sanitizados} e-mail(s) sanitizado(s): ${d.clientes_atualizados} cliente(s), ` +
        `${d.contatos_atualizados} contato(s) atualizados, ${d.removidos_do_grupo} removido(s) do grupo.`,
      )
      carregarErrosDefinitivos()
    } catch {
      setErro('Erro de conexão ao sanitizar e-mails.')
    } finally {
      setSanitizando(false)
    }
  }

  async function retomar(reincluirErros: boolean) {
    setRetomando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/campanhas/${id}/retomar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reincluir_erros: reincluirErros }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao retomar campanha.'); return }
      carregar()
    } catch {
      setErro('Erro de conexão ao retomar campanha.')
    } finally {
      setRetomando(false)
    }
  }

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>Campanha #{campanha.id} — {campanha.assunto}</h2>
        <button className="botao-secundario" type="button" onClick={() => navigate('/campanhas')}>← Voltar</button>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        Grupo: <strong>{campanha.grupo_nome}</strong>
        {' · '}Criada em {formatarData(campanha.criado_em)}
        {campanha.enviado_em && <> · Concluída em {formatarData(campanha.enviado_em)}</>}
      </p>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="badge-ativo" style={{ padding: '8px 16px', fontSize: '13px' }}>
          Total: <strong>{campanha.total_destinatarios ?? envios.length}</strong>
        </div>
        <div className="badge-ativo" style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--sucesso-bg)', color: 'var(--sucesso)' }}>
          Enviados: <strong>{enviados.length}</strong>
        </div>
        <div className="badge-ativo" style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--perigo-bg)', color: 'var(--perigo)' }}>
          Erros: <strong>{comErro.length}</strong>
        </div>
        {pendentes.length > 0 && (
          <div className="badge-ativo" style={{ padding: '8px 16px', fontSize: '13px' }}>
            Pendentes: <strong>{pendentes.length}</strong>
            {campanha.status_processamento === 'processando' && ' (enviando...)'}
          </div>
        )}
      </div>

      {comErro.length > 0 && (
        <p style={{ fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <button className="botao-secundario" type="button" onClick={copiarEmailsComErro}>
            Copiar e-mails com erro ({comErro.length})
          </button>
          {errosDefinitivos.length > 0 && (
            <button className="botao-perigo" type="button" disabled={sanitizando} onClick={sanitizar}>
              {sanitizando ? 'Sanitizando...' : `Sanitizar (${errosDefinitivos.length} inválido${errosDefinitivos.length > 1 ? 's' : ''})`}
            </button>
          )}
          <span style={{ color: 'var(--text)' }}>
            {errosDefinitivos.length > 0
              ? 'Sanitizar remove do grupo e marca o e-mail como inválido no cadastro (pendente de recadastro). Os demais erros podem ser temporários (limite/timeout) — tente reenviar antes.'
              : 'Use para localizar e corrigir/excluir esses contatos.'}
          </span>
        </p>
      )}

      {campanha.status_processamento !== 'processando' && (pendentes.length > 0 || comErro.length > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {pendentes.length > 0 && (
            <button className="botao" type="button" disabled={retomando} onClick={() => retomar(false)}>
              {retomando ? 'Retomando...' : `Retomar envio (${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''})`}
            </button>
          )}
          {comErro.length > 0 && (
            <button className="botao-secundario" type="button" disabled={retomando} onClick={() => retomar(true)}>
              {retomando ? 'Retomando...' : `Tentar de novo os ${comErro.length} com erro`}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusEnvio | '')}
          style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--raio)', border: '1px solid var(--border)' }}
        >
          <option value="">Todos os destinatários</option>
          <option value="enviado">Enviados</option>
          <option value="erro">Com erro</option>
          <option value="pendente">Pendentes</option>
        </select>
      </div>

      <div className="tabela-wrapper">
        <table className="tabela">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Nome</th>
              <th>Status</th>
              <th>Detalhe do erro</th>
              <th>Enviado em</th>
            </tr>
          </thead>
          <tbody>
            {enviosFiltrados.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text)' }}>Nenhum destinatário neste filtro.</td></tr>
            )}
            {enviosFiltrados.map((e) => (
              <tr key={e.id}>
                <td>{e.email}</td>
                <td>{e.nome ?? '—'}</td>
                <td><span className={CLASSE_STATUS_ENVIO[e.status]}>{LABEL_STATUS_ENVIO[e.status]}</span></td>
                <td style={{ fontSize: '12px', color: 'var(--text)' }}>{e.mensagem_erro ?? '—'}</td>
                <td>{e.enviado_em ? formatarData(e.enviado_em) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
