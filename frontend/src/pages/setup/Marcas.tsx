import { useEffect, useState } from 'react'

type Item = { id: number; nome: string }

export function Marcas() {
  const [lista, setLista] = useState<Item[]>([])
  const [nova, setNova] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const res = await fetch('/api/marcas', { credentials: 'include' })
    const d = await res.json()
    setLista(d.marcas ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function adicionar() {
    const nome = nova.trim().toUpperCase()
    if (!nome) return
    const res = await fetch('/api/marcas', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    const d = await res.json()
    if (res.ok) {
      setLista((l) => [...l, d.marca].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setNova('')
    } else {
      setErro(d.erro ?? 'Erro ao adicionar.')
    }
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Remover a marca "${nome}"?`)) return
    await fetch(`/api/marcas/${id}`, { method: 'DELETE', credentials: 'include' })
    setLista((l) => l.filter((x) => x.id !== id))
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Marcas</h2>
      {erro && <p className="alerta-erro">{erro}</p>}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: '200px' }}
          placeholder="Nova marca"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar() } }}
        />
        <button className="botao-secundario" type="button" onClick={adicionar}>Adicionar</button>
      </div>
      <div className="tabela-wrapper">
        <table className="tabela">
          <thead><tr><th>Nome</th><th style={{ width: '80px' }}></th></tr></thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={2} style={{ textAlign: 'center' }}>Nenhuma marca cadastrada.</td></tr>
            )}
            {lista.map((m) => (
              <tr key={m.id}>
                <td>{m.nome}</td>
                <td>
                  <button className="botao-perigo" type="button" onClick={() => remover(m.id, m.nome)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
