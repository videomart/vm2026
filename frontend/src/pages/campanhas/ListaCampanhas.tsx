import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatarData } from '../../utils/formatar'

type Campanha = {
  id: number
  assunto: string
  grupo_id: number
  grupo_nome: string
  enviado_por_nome: string
  enviado_em: string | null
  criado_em: string
}

export function ListaCampanhas() {
  const navigate = useNavigate()
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  function carregar() {
    fetch('/api/campanhas', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCampanhas(d.campanhas ?? []))
      .catch(() => setErro('Erro ao carregar campanhas.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

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
              <th style={{ width: '160px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text)' }}>Nenhuma campanha enviada ainda.</td></tr>
            )}
            {campanhas.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.assunto}</td>
                <td>{c.grupo_nome}</td>
                <td>{c.enviado_por_nome}</td>
                <td>{c.enviado_em ? formatarData(c.enviado_em) : <em style={{ opacity: 0.5 }}>pendente</em>}</td>
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
