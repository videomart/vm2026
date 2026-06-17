import { useEffect, useState } from 'react'
import { useGrid } from '../../hooks/useGrid'

type Item = { id: number; nome: string; total_clientes: number }

export function CategoriasCliente() {
  const [lista, setLista] = useState<Item[]>([])
  const [nova, setNova] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(lista, 'nome')

  async function carregar() {
    const res = await fetch('/api/categorias-cliente', { credentials: 'include' })
    const d = await res.json()
    setLista(d.categorias ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function adicionar() {
    const nome = nova.trim().toUpperCase()
    if (!nome) return
    const res = await fetch('/api/categorias-cliente', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    const d = await res.json()
    if (res.ok) {
      setLista((l) => [...l, { ...d.categoria, total_clientes: 0 }])
      setNova('')
    } else {
      setErro(d.erro ?? 'Erro ao adicionar.')
    }
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Remover a categoria "${nome}"?`)) return
    setErro(null)
    const res = await fetch(`/api/categorias-cliente/${id}`, { method: 'DELETE', credentials: 'include' })
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
      <h2>Categorias de cliente</h2>
      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        Classifica o tipo de cliente (TV, produtora, universidade etc.) para facilitar filtros e campanhas de e-mail.
      </p>
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
          <thead>
            <tr>
              <th {...grid.th('nome')}>Nome</th>
              <th {...grid.th('total_clientes')} style={{ width: '140px' }}>Clientes vinculados</th>
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
                <td>{c.total_clientes}</td>
                <td>
                  <button
                    className="botao-perigo"
                    type="button"
                    onClick={() => remover(c.id, c.nome)}
                    disabled={c.total_clientes > 0}
                    title={c.total_clientes > 0 ? 'Categoria vinculada a clientes não pode ser removida.' : undefined}
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
