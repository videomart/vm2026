import { useEffect, useState } from 'react'

type Item = { id: number; nome: string }

export function Categorias() {
  const [lista, setLista] = useState<Item[]>([])
  const [nova, setNova] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const res = await fetch('/api/categorias', { credentials: 'include' })
    const d = await res.json()
    setLista(d.categorias ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function adicionar() {
    const nome = nova.trim().toUpperCase()
    if (!nome) return
    const res = await fetch('/api/categorias', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    const d = await res.json()
    if (res.ok) {
      setLista((l) => [...l, d.categoria].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setNova('')
    } else {
      setErro(d.erro ?? 'Erro ao adicionar.')
    }
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Remover a categoria "${nome}"?`)) return
    await fetch(`/api/categorias/${id}`, { method: 'DELETE', credentials: 'include' })
    setLista((l) => l.filter((x) => x.id !== id))
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Categorias</h2>
      {erro && <p className="alerta-erro">{erro}</p>}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: '200px' }}
          placeholder="Nova categoria"
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
              <tr><td colSpan={2} style={{ textAlign: 'center' }}>Nenhuma categoria cadastrada.</td></tr>
            )}
            {lista.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td>
                  <button className="botao-perigo" type="button" onClick={() => remover(c.id, c.nome)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
