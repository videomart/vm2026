import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatarData } from '../../utils/formatar'

type Campanha = {
  id: number
  assunto: string
  grupo_nome: string
  enviado_por_nome: string
  enviado_em: string | null
  criado_em: string
}

export function ListaCampanhas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/campanhas', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCampanhas(d.campanhas ?? []))
      .finally(() => setCarregando(false))
  }, [])

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

      <div className="tabela-wrapper">
        <table className="tabela">
          <thead>
            <tr>
              <th>#</th>
              <th>Assunto</th>
              <th>Grupo</th>
              <th>Enviado por</th>
              <th>Enviado em</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text)' }}>Nenhuma campanha enviada ainda.</td></tr>
            )}
            {campanhas.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.assunto}</td>
                <td>{c.grupo_nome}</td>
                <td>{c.enviado_por_nome}</td>
                <td>{c.enviado_em ? formatarData(c.enviado_em) : <em style={{ opacity: 0.5 }}>pendente</em>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
