import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatarData } from '../../utils/formatar'

type StatusProcessamento = 'processando' | 'concluida' | 'erro' | null

type Campanha = {
  id: number
  assunto: string
  grupo_id: number
  grupo_nome: string
  enviado_por_nome: string
  enviado_em: string | null
  criado_em: string
  status_processamento: StatusProcessamento
  total_destinatarios: number | null
  total_enviados: number
  total_erros: number
}

const LABEL_STATUS: Record<string, string> = {
  processando: 'Enviando...',
  concluida: 'Concluída',
  erro: 'Erro',
}

export function ListaCampanhas() {
  const navigate = useNavigate()
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  function carregar() {
    fetch('/api/campanhas', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCampanhas(d.campanhas ?? []))
      .catch(() => setErro('Erro ao carregar campanhas.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  // Atualiza automaticamente enquanto houver campanha em processamento
  useEffect(() => {
    const temProcessando = campanhas.some((c) => c.status_processamento === 'processando')
    if (temProcessando && !pollTimer.current) {
      pollTimer.current = setInterval(carregar, 5000)
    } else if (!temProcessando && pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    return () => {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null }
    }
  }, [campanhas])

  async function remover(id: number, assunto: string) {
    if (!confirm(`Excluir o registro da campanha "${assunto}"? Isso não desfaz e-mails já enviados, apenas remove o histórico.`)) return
    setErro(null)
    try {
      const res = await fetch(`/api/campanhas/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setErro(d?.erro ?? 'Erro ao excluir campanha.')
        return
      }
      setCampanhas((c) => c.filter((x) => x.id !== id))
    } catch {
      setErro('Erro de conexão ao excluir campanha.')
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <div className="cabecalho-lista">
        <h2>E-mails episódicos</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/campanhas/grupos" className="botao-secundario">Gerenciar grupos</Link>
          <Link to="/campanhas/templates" className="botao-secundario">Templates</Link>
          <Link to="/campanhas/nova" className="botao">Nova campanha</Link>
        </div>
      </div>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div className="tabela-wrapper">
        <table className="tabela">
          <thead>
            <tr>
              <th>#</th>
              <th>Assunto</th>
              <th>Grupo</th>
              <th>Enviado por</th>
              <th>Enviado em</th>
              <th>Progresso</th>
              <th style={{ width: '160px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text)' }}>Nenhuma campanha enviada ainda.</td></tr>
            )}
            {campanhas.map((c) => {
              const total = c.total_destinatarios ?? 0
              const processado = c.total_enviados + c.total_erros
              return (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td><Link to={`/campanhas/${c.id}`}>{c.assunto}</Link></td>
                  <td>{c.grupo_nome}</td>
                  <td>{c.enviado_por_nome}</td>
                  <td>{c.enviado_em ? formatarData(c.enviado_em) : <em style={{ opacity: 0.5 }}>pendente</em>}</td>
                  <td>
                    {c.status_processamento ? (
                      <span style={{ fontSize: '12px' }}>
                        <span className={`badge ${c.status_processamento === 'concluida' ? 'badge-sucesso' : c.status_processamento === 'erro' ? 'badge-inativo' : 'badge-ativo'}`}>
                          {LABEL_STATUS[c.status_processamento]}
                        </span>
                        {' '}
                        {processado}/{total}
                        {c.total_erros > 0 && (
                          <span style={{ color: 'var(--perigo)' }}> ({c.total_erros} erro{c.total_erros > 1 ? 's' : ''})</span>
                        )}
                      </span>
                    ) : (
                      <em style={{ opacity: 0.5, fontSize: '12px' }}>—</em>
                    )}
                  </td>
                  <td>
                    <div className="acoes">
                      <button className="botao-link" type="button" onClick={() => navigate(`/campanhas/nova?reenviar=${c.id}`)}>
                        Reenviar
                      </button>
                      <button className="botao-perigo" type="button" onClick={() => remover(c.id, c.assunto)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
