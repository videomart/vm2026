import { useEffect, useState } from 'react'
import { useGrid } from '../../hooks/useGrid'
import type { ComposicaoHardware } from '../produtos/types'

const VAZIO = { nome: '', itens: '' }

export function ComposicoesHardware() {
  const [lista, setLista] = useState<ComposicaoHardware[]>([])
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [campos, setCampos] = useState(VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const grid = useGrid(lista, 'nome')

  async function carregar() {
    const res = await fetch('/api/composicoes-hardware', { credentials: 'include' })
    const d = await res.json()
    setLista(d.composicoes ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  function editar(c: ComposicaoHardware) {
    setEditandoId(c.id)
    setCampos({ nome: c.nome, itens: c.itens })
    setErro(null)
  }

  function cancelar() {
    setEditandoId(null)
    setCampos(VAZIO)
    setErro(null)
  }

  async function salvar() {
    const nome = campos.nome.trim()
    const itens = campos.itens.trim()
    if (!nome || !itens) { setErro('Nome e itens são obrigatórios.'); return }

    setErro(null)
    const url = editandoId ? `/api/composicoes-hardware/${editandoId}` : '/api/composicoes-hardware'
    const res = await fetch(url, {
      method: editandoId ? 'PUT' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, itens }),
    })
    const d = await res.json()
    if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar.'); return }
    cancelar()
    carregar()
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Remover a composição "${nome}"?`)) return
    setErro(null)
    const res = await fetch(`/api/composicoes-hardware/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      setLista((l) => l.filter((x) => x.id !== id))
    } else {
      const d = await res.json()
      setErro(d.erro ?? 'Erro ao remover composição.')
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Composições de hardware</h2>
      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>
        Templates de composição de hardware para produtos do tipo "Solução integrada (turnkey)".
        Servem só para inicializar o campo no cadastro do produto — depois de carregado, o texto
        pode ser editado livremente em cada produto sem afetar o template aqui.
      </p>
      {erro && <p className="alerta-erro">{erro}</p>}

      <div className="campo campo-largo" style={{ marginBottom: '16px', maxWidth: '480px' }}>
        <label htmlFor="ch_nome">{editandoId ? 'Editar composição' : 'Nova composição'}</label>
        <input
          id="ch_nome"
          placeholder="Nome (ex.: Padrão Rack)"
          value={campos.nome}
          onChange={(e) => setCampos((c) => ({ ...c, nome: e.target.value }))}
          style={{ marginBottom: '6px' }}
        />
        <textarea
          id="ch_itens"
          className="sem-uppercase"
          rows={5}
          placeholder="1 item por linha (ex.: Processador i7, 16GB RAM, SSD 512GB)"
          value={campos.itens}
          onChange={(e) => setCampos((c) => ({ ...c, itens: e.target.value }))}
          style={{ resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button className="botao-secundario" type="button" onClick={salvar}>
            {editandoId ? 'Salvar alterações' : 'Adicionar'}
          </button>
          {editandoId && (
            <button className="botao-secundario" type="button" onClick={cancelar}>Cancelar</button>
          )}
        </div>
      </div>

      <div className="tabela-wrapper">
        <table className="tabela">
          <thead>
            <tr>
              <th {...grid.th('nome')}>Nome</th>
              <th>Itens</th>
              <th style={{ width: '160px' }}></th>
            </tr>
          </thead>
          <tbody>
            {grid.ordenados.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center' }}>Nenhuma composição cadastrada.</td></tr>
            )}
            {grid.ordenados.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td style={{ whiteSpace: 'pre-line', fontSize: '12px' }}>{c.itens}</td>
                <td>
                  <button className="botao-secundario" type="button" onClick={() => editar(c)}>Editar</button>{' '}
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
