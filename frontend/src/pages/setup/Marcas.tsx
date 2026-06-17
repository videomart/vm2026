import { useEffect, useState } from 'react'
import { useGrid } from '../../hooks/useGrid'

type Item = { id: number; nome: string; total_produtos: number }

export function Marcas() {
  const [lista, setLista] = useState<Item[]>([])
  const [nova, setNova] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(lista, 'nome')

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
      setLista((l) => [...l, { ...d.marca, total_produtos: 0 }])
      setNova('')
    } else {
      setErro(d.erro ?? 'Erro ao adicionar.')
    }
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Remover a marca "${nome}"?`)) return
    setErro(null)
    const res = await fetch(`/api/marcas/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      setLista((l) => l.filter((x) => x.id !== id))
    } else {
      const d = await res.json()
      setErro(d.erro ?? 'Erro ao remover marca.')
    }
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
          <thead>
            <tr>
              <th {...grid.th('nome')}>Nome</th>
              <th {...grid.th('total_produtos')} style={{ width: '140px' }}>Produtos vinculados</th>
              <th style={{ width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {grid.ordenados.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center' }}>Nenhuma marca cadastrada.</td></tr>
            )}
            {grid.ordenados.map((m) => (
              <tr key={m.id}>
                <td>{m.nome}</td>
                <td>{m.total_produtos}</td>
                <td>
                  <button
                    className="botao-perigo"
                    type="button"
                    onClick={() => remover(m.id, m.nome)}
                    disabled={m.total_produtos > 0}
                    title={m.total_produtos > 0 ? 'Marca vinculada a produtos não pode ser removida.' : undefined}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
