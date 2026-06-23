import { useEffect, useState } from 'react'

type Cotacao = { id: number; data: string; valor: string; fonte: string | null }

export function CotacaoDolar() {
  const [cotacao, setCotacao] = useState<Cotacao | null>(null)
  const [historico, setHistorico] = useState<Cotacao[]>([])
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [valor, setValor] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function carregar() {
    fetch('/api/setup/cotacao', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setCotacao(d.cotacao ?? null)
        setHistorico(d.historico ?? [])
      })
      .catch(() => setErro('Erro ao carregar cotação.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!valor) return
    setMsg(null)
    setErro(null)
    const res = await fetch('/api/setup/cotacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ data, valor, fonte: 'manual' }),
    })
    const d = await res.json()
    if (res.ok) {
      setMsg('Cotação salva.')
      setValor('')
      carregar()
    } else {
      setErro(d.erro ?? 'Erro ao salvar cotação.')
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Cotação do dólar</h2>
      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        Usada para sugerir preços em produtos importados e para converter lançamentos financeiros entre moedas.
      </p>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {cotacao ? (
        <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text)' }}>
          Última cotação:{' '}
          <strong style={{ color: 'var(--text-h)' }}>
            R$ {Number(cotacao.valor).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}
          </strong>{' '}
          em {cotacao.data?.slice(0, 10).split('-').reverse().join('/')}
          {cotacao.fonte && ` (${cotacao.fonte})`}
        </p>
      ) : (
        <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text)' }}>Nenhuma cotação cadastrada ainda.</p>
      )}

      <form onSubmit={salvar} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div className="campo" style={{ margin: 0 }}>
          <label>Data</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </div>
        <div className="campo" style={{ margin: 0 }}>
          <label>Valor (R$)</label>
          <input type="number" min="0.01" step="0.0001" placeholder="5.7500" value={valor} onChange={(e) => setValor(e.target.value)} required />
        </div>
        <button className="botao" type="submit">Salvar cotação</button>
      </form>

      {historico.length > 0 && (
        <div className="tabela-wrapper">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Valor (R$)</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((c) => (
                <tr key={c.id}>
                  <td>{c.data?.slice(0, 10).split('-').reverse().join('/')}</td>
                  <td>{Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td>
                  <td>{c.fonte ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
