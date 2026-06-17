import { useEffect, useState } from 'react'

type Condicao = { id: number; descricao: string; corpo: string | null }

const CORPO_PADRAO = `Prazo de entrega: 30 dias úteis
Período de garantia: 01 ANO
Condições de pagamento: 10 DIAS APÓS ENTREGA
Forma de pagamento: Depósito bancário
Validade da proposta: 3 dias
Frete: Não incluso
Preço fornecido em Reais`

export function Condicoes() {
  const [condicoes, setCondicoes] = useState<Condicao[]>([])
  const [novaNome, setNovaNome] = useState('')
  const [novaCorpo, setNovaCorpo] = useState(CORPO_PADRAO)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/setup/condicoes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCondicoes(d.condicoes ?? []))
      .catch(() => setErro('Erro ao carregar condições.'))
      .finally(() => setCarregando(false))
  }, [])

  function resetForm() {
    setNovaNome('')
    setNovaCorpo(CORPO_PADRAO)
    setEditandoId(null)
  }

  function editarCondicao(c: Condicao) {
    setEditandoId(c.id)
    setNovaNome(c.descricao)
    setNovaCorpo(c.corpo ?? CORPO_PADRAO)
  }

  async function salvarCondicao() {
    if (!novaNome.trim()) return
    setErro(null)
    setMsg(null)
    const isEdicao = editandoId !== null
    const url = isEdicao ? `/api/setup/condicoes/${editandoId}` : '/api/setup/condicoes'
    const method = isEdicao ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao: novaNome.trim(), corpo: novaCorpo.trim() || null }),
    })
    const d = await res.json()
    if (res.ok) {
      if (isEdicao) {
        setCondicoes((prev) =>
          prev.map((c) =>
            c.id === editandoId ? { ...c, descricao: novaNome.trim(), corpo: novaCorpo.trim() || null } : c,
          ),
        )
        setMsg('Condição atualizada.')
      } else {
        setCondicoes((prev) =>
          [...prev, d.condicao].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
        )
        setMsg('Condição adicionada.')
      }
      resetForm()
    } else {
      setErro(d.erro ?? 'Erro ao salvar.')
    }
  }

  async function removerCondicao(id: number) {
    if (!confirm('Remover esta condição?')) return
    await fetch(`/api/setup/condicoes/${id}`, { method: 'DELETE', credentials: 'include' })
    setCondicoes((c) => c.filter((x) => x.id !== id))
    if (editandoId === id) resetForm()
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Condições de pagamento</h2>
      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        O campo "Corpo" é preenchido automaticamente no campo Condições da proposta ao selecionar esta opção.
      </p>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {/* Formulário add / edição */}
      <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
        <div className="grade-formulario">
          <div className="campo campo-largo">
            <label>Nome da condição (label do select nas propostas)</label>
            <input
              placeholder="Ex.: 10 dias após entrega"
              value={novaNome}
              onChange={(e) => setNovaNome(e.target.value)}
            />
          </div>
        </div>
        <div className="campo">
          <label>Corpo — texto completo que vai para o campo Condições da proposta</label>
          <textarea
            className="sem-uppercase"
            rows={9}
            value={novaCorpo}
            onChange={(e) => setNovaCorpo(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="botao" type="button" onClick={salvarCondicao}>
            {editandoId ? 'Salvar alterações' : 'Adicionar condição'}
          </button>
          {editandoId && (
            <button className="botao-secundario" type="button" onClick={resetForm}>Cancelar</button>
          )}
        </div>
      </div>

      <div className="tabela-wrapper">
        <table className="tabela">
          <thead>
            <tr>
              <th style={{ width: '220px' }}>Nome</th>
              <th>Corpo (prévia)</th>
              <th style={{ width: '130px' }}></th>
            </tr>
          </thead>
          <tbody>
            {condicoes.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text)' }}>Nenhuma condição cadastrada.</td></tr>
            )}
            {condicoes.map((c) => (
              <tr key={c.id} style={editandoId === c.id ? { background: 'var(--bg-alt)' } : {}}>
                <td style={{ verticalAlign: 'top' }}>{c.descricao}</td>
                <td style={{ verticalAlign: 'top', fontSize: '12px', color: 'var(--text)', whiteSpace: 'pre-wrap', maxWidth: '400px' }}>
                  {c.corpo
                    ? c.corpo.slice(0, 180) + (c.corpo.length > 180 ? '…' : '')
                    : <em style={{ opacity: 0.5 }}>sem corpo</em>}
                </td>
                <td>
                  <div className="acoes">
                    <button className="botao-link" type="button" onClick={() => editarCondicao(c)}>Editar</button>
                    <button className="botao-perigo" type="button" onClick={() => removerCondicao(c.id)}>Remover</button>
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
