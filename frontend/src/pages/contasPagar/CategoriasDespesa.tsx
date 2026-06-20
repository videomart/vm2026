import { useEffect, useState } from 'react'
import { useGrid } from '../../hooks/useGrid'

type Item = { id: number; nome: string; total_contas: number }

export function CategoriasDespesa() {
  const [lista, setLista] = useState<Item[]>([])
  const [nova, setNova] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(lista, 'nome')

  async function carregar() {
    const res = await fetch('/api/categorias-despesa', { credentials: 'include' })
    const d = await res.json()
    setLista(d.categorias ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function adicionar() {
    const nome = nova.trim()
    if (!nome) return
    const res = await fetch('/api/categorias-despesa', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    const d = await res.json()
    if (res.ok) {
      setLista((l) => [...l, { ...d.categoria, total_contas: 0 }])
      setNova('')
    } else {
      setErro(d.erro ?? 'Erro ao adicionar.')
    }
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Remover a categoria "${nome}"?`)) return
    setErro(null)
    const res = await fetch(`/api/categorias-despesa/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      setLista((l) => l.filter((x) => x.id !== id))
    } else {
      const d = await res.json()
      setErro(d.erro ?? 'Erro ao remover categoria.')
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Categorias de despesa</h2>
      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        Classifica o tipo de despesa (aluguel, fornecedores, impostos etc.) para facilitar filtros e relatórios.
      </p>
      {erro && <p className="alerta-erro">{erro}</p>}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: '200px' }}
          className="sem-uppercase"
          placeholder="Nova categoria"
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
              <th {...grid.th('total_contas')} style={{ width: '140px' }}>Contas vinculadas</th>
              <th style={{ width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {grid.ordenados.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center' }}>Nenhuma categoria cadastrada.</td></tr>
            )}
            {grid.ordenados.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td>{c.total_contas}</td>
                <td>
                  <button
                    className="botao-perigo"
                    type="button"
                    onClick={() => remover(c.id, c.nome)}
                    disabled={c.total_contas > 0}
                    title={c.total_contas > 0 ? 'Categoria vinculada a contas a pagar não pode ser removida.' : undefined}
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
