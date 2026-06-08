import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ItemFormulario, Proposta, StatusProposta } from './types'
import type { Cliente } from '../clientes/types'
import type { Produto } from '../produtos/types'

type UsuarioSimples = { id: number; nome: string; papel: string }

const ITEM_VAZIO: ItemFormulario = {
  produto_id: null,
  descricao: '',
  quantidade: '1',
  valor_unitario: '0',
  desconto: '0',
}

function calcSubtotal(item: ItemFormulario): number {
  const qtd = Number(item.quantidade) || 0
  const unit = Number(item.valor_unitario) || 0
  const desc = Number(item.desconto) || 0
  return Math.max(0, qtd * unit - desc)
}

function formatarValor(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const LABELS_STATUS: Record<StatusProposta, string> = {
  aberta: 'Aberta',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  convertida: 'Convertida',
}

export function FormularioProposta() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  // dados auxiliares
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioSimples[]>([])
  const [usuarioAtual, setUsuarioAtual] = useState<UsuarioSimples | null>(null)

  // proposta carregada (para edição / visualização)
  const [proposta, setProposta] = useState<Proposta | null>(null)

  // campos do cabeçalho
  const [clienteId, setClienteId] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [validade, setValidade] = useState('')
  const [condicoes, setCondicoes] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [desconto, setDesconto] = useState('0')

  // itens
  const [itens, setItens] = useState<ItemFormulario[]>([{ ...ITEM_VAZIO }])

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  // carrega dados auxiliares + proposta (se editando)
  useEffect(() => {
    async function init() {
      try {
        const [resMe, resClientes, resProdutos, resUsuarios] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/clientes', { credentials: 'include' }),
          fetch('/api/produtos', { credentials: 'include' }),
          fetch('/api/auth/usuarios', { credentials: 'include' }),
        ])
        const [me, clientesData, produtosData, usuariosData] = await Promise.all([
          resMe.json(), resClientes.json(), resProdutos.json(), resUsuarios.json(),
        ])

        setUsuarioAtual(me.usuario)
        setClientes(clientesData.clientes ?? [])
        setProdutos(produtosData.produtos ?? [])
        setUsuarios(usuariosData.usuarios ?? [])

        if (me.usuario) {
          setVendedorId(String(me.usuario.id))
        }

        if (editando && id) {
          const res = await fetch(`/api/propostas/${id}`, { credentials: 'include' })
          if (!res.ok) { setErro('Proposta não encontrada.'); return }
          const { proposta: p } = await res.json()
          setProposta(p)
          setClienteId(String(p.cliente_id))
          setVendedorId(String(p.vendedor_id))
          setData(p.data.slice(0, 10))
          setValidade(p.validade ? p.validade.slice(0, 10) : '')
          setCondicoes(p.condicoes_pagamento ?? '')
          setObservacoes(p.observacoes ?? '')
          setDesconto(String(p.desconto ?? '0'))
          if (p.itens?.length) {
            setItens(p.itens.map((item: any) => ({
              produto_id: item.produto_id,
              descricao: item.descricao,
              quantidade: String(item.quantidade),
              valor_unitario: String(item.valor_unitario),
              desconto: String(item.desconto),
            })))
          }
        }
      } catch {
        setErro('Erro ao carregar dados.')
      } finally {
        setCarregando(false)
      }
    }
    init()
  }, [id, editando])

  const somaItens = itens.reduce((acc, item) => acc + calcSubtotal(item), 0)
  const totalFinal = Math.max(0, somaItens - (Number(desconto) || 0))
  const somenteLeitura = proposta !== null && proposta.status !== 'aberta'

  // ---- itens helpers ----
  function atualizarItem(idx: number, campo: keyof ItemFormulario, valor: string | number | null) {
    setItens((prev) => prev.map((item, i) => i === idx ? { ...item, [campo]: valor } : item))
  }

  function selecionarProduto(idx: number, produtoId: string) {
    const pid = Number(produtoId)
    const produto = produtos.find((p) => p.id === pid)
    if (produto) {
      setItens((prev) => prev.map((item, i) => i !== idx ? item : {
        ...item,
        produto_id: pid,
        descricao: produto.modelo,
        valor_unitario: produto.preco_venda ?? '0',
      }))
    } else {
      atualizarItem(idx, 'produto_id', null)
    }
  }

  function adicionarItem() {
    setItens((prev) => [...prev, { ...ITEM_VAZIO }])
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx))
  }

  // ---- submit ----
  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (somenteLeitura) return
    setErro(null)
    setSalvando(true)
    try {
      const body = {
        cliente_id: Number(clienteId),
        vendedor_id: Number(vendedorId),
        data,
        validade: validade || null,
        condicoes_pagamento: condicoes || null,
        observacoes: observacoes || null,
        desconto: Number(desconto) || 0,
        itens: itens.map((item) => ({
          produto_id: item.produto_id,
          descricao: item.descricao,
          quantidade: Number(item.quantidade),
          valor_unitario: Number(item.valor_unitario),
          desconto: Number(item.desconto) || 0,
        })),
      }
      const res = await fetch(editando ? `/api/propostas/${id}` : '/api/propostas', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data_resp = await res.json()
      if (!res.ok) { setErro(data_resp.erro ?? 'Não foi possível salvar.'); return }
      navigate('/propostas')
    } catch {
      setErro('Erro de conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  // ---- ações de status ----
  async function mudarStatus(novoStatus: 'aprovada' | 'recusada') {
    setErro(null)
    const res = await fetch(`/api/propostas/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: novoStatus }),
    })
    const d = await res.json()
    if (!res.ok) { setErro(d.erro ?? 'Erro ao atualizar status.'); return }
    setProposta((prev) => prev ? { ...prev, status: novoStatus } : prev)
    setMensagem(`Proposta marcada como ${LABELS_STATUS[novoStatus]}.`)
  }

  async function converter() {
    if (!confirm('Converter esta proposta em venda? Esta ação não pode ser desfeita.')) return
    setErro(null)
    const res = await fetch(`/api/propostas/${id}/converter`, {
      method: 'POST',
      credentials: 'include',
    })
    const d = await res.json()
    if (!res.ok) { setErro(d.erro ?? 'Erro ao converter.'); return }
    setMensagem(`Venda #${d.venda_id} criada com conta a receber automática.`)
    setProposta((prev) => prev ? { ...prev, status: 'convertida' } : prev)
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <div className="cabecalho-secao">
        <h2>
          {editando ? `Proposta #${id}` : 'Nova proposta'}
          {proposta && (
            <span className={`badge badge-${proposta.status}`} style={{ marginLeft: '0.75rem', fontSize: '0.8rem' }}>
              {LABELS_STATUS[proposta.status]}
            </span>
          )}
        </h2>
        {!editando && (
          <button className="botao-secundario" type="button" onClick={() => navigate('/propostas')}>
            Cancelar
          </button>
        )}
      </div>

      {mensagem && <p className="alerta-sucesso" role="status">{mensagem}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <form onSubmit={handleSubmit}>
        {/* cabeçalho */}
        <div className="grade-formulario">
          <div className="campo campo-largo">
            <label htmlFor="cliente_id">Cliente *</label>
            <select
              id="cliente_id"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              required
              disabled={somenteLeitura}
            >
              <option value="">— Selecione —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.razao_social}{c.nome_fantasia ? ` / ${c.nome_fantasia}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="vendedor_id">Vendedor *</label>
            <select
              id="vendedor_id"
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
              required
              disabled={somenteLeitura || usuarioAtual?.papel !== 'admin'}
            >
              <option value="">— Selecione —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="data">Data *</label>
            <input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} required disabled={somenteLeitura} />
          </div>
          <div className="campo">
            <label htmlFor="validade">Validade</label>
            <input id="validade" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} disabled={somenteLeitura} />
          </div>
          <div className="campo campo-largo">
            <label htmlFor="condicoes">Condições de pagamento</label>
            <input id="condicoes" value={condicoes} onChange={(e) => setCondicoes(e.target.value)} disabled={somenteLeitura} />
          </div>
          <div className="campo campo-largo">
            <label htmlFor="observacoes">Observações</label>
            <textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={somenteLeitura} />
          </div>
        </div>

        {/* itens */}
        <div style={{ margin: '1.5rem 0 0.5rem' }}>
          <strong>Itens da proposta</strong>
        </div>
        <div className="tabela-wrapper">
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Descrição *</th>
                <th style={{ width: '6rem' }}>Qtd *</th>
                <th style={{ width: '8rem' }}>Vlr Unit. *</th>
                <th style={{ width: '8rem' }}>Desconto</th>
                <th style={{ width: '8rem' }}>Subtotal</th>
                {!somenteLeitura && <th style={{ width: '3rem' }}></th>}
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <select
                      value={item.produto_id ?? ''}
                      onChange={(e) => selecionarProduto(idx, e.target.value)}
                      disabled={somenteLeitura}
                      style={{ width: '100%' }}
                    >
                      <option value="">— Livre —</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>{p.modelo}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={item.descricao}
                      onChange={(e) => atualizarItem(idx, 'descricao', e.target.value)}
                      required
                      disabled={somenteLeitura}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(idx, 'quantidade', e.target.value)}
                      required
                      disabled={somenteLeitura}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0" step="0.01"
                      value={item.valor_unitario}
                      onChange={(e) => atualizarItem(idx, 'valor_unitario', e.target.value)}
                      required
                      disabled={somenteLeitura}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0" step="0.01"
                      value={item.desconto}
                      onChange={(e) => atualizarItem(idx, 'desconto', e.target.value)}
                      disabled={somenteLeitura}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatarValor(calcSubtotal(item))}
                  </td>
                  {!somenteLeitura && (
                    <td>
                      <button
                        type="button"
                        className="botao-perigo"
                        onClick={() => removerItem(idx)}
                        disabled={itens.length === 1}
                        title="Remover item"
                      >✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!somenteLeitura && (
          <button type="button" className="botao-secundario" style={{ marginTop: '0.5rem' }} onClick={adicionarItem}>
            + Adicionar item
          </button>
        )}

        {/* totais */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', margin: '1rem 0' }}>
          <span>Soma dos itens: <strong>{formatarValor(somaItens)}</strong></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="desconto_proposta">Desconto geral (R$):</label>
            <input
              id="desconto_proposta"
              type="number" min="0" step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              disabled={somenteLeitura}
              style={{ width: '8rem', textAlign: 'right' }}
            />
          </div>
          <span style={{ fontSize: '1.1rem' }}>Total: <strong>{formatarValor(totalFinal)}</strong></span>
        </div>

        {/* botões de ação */}
        {!somenteLeitura && (
          <div className="barra-acoes-formulario">
            <button className="botao" type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="botao-secundario" type="button" onClick={() => navigate('/propostas')}>
              Cancelar
            </button>
          </div>
        )}

        {somenteLeitura && proposta && (
          <div className="barra-acoes-formulario">
            {proposta.status === 'aberta' && (
              <>
                <button type="button" className="botao" onClick={() => mudarStatus('aprovada')}>Aprovar</button>
                <button type="button" className="botao-perigo" onClick={() => mudarStatus('recusada')}>Recusar</button>
              </>
            )}
            {(proposta.status === 'aberta' || proposta.status === 'aprovada') && (
              <button type="button" className="botao" onClick={converter}>
                Converter em venda
              </button>
            )}
            <button type="button" className="botao-secundario" onClick={() => navigate('/propostas')}>
              Voltar
            </button>
          </div>
        )}

        {/* ações para proposta aberta também quando editando */}
        {editando && proposta?.status === 'aberta' && (
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="botao-secundario" onClick={() => mudarStatus('aprovada')}>Aprovar</button>
            <button type="button" className="botao-perigo" onClick={() => mudarStatus('recusada')}>Recusar</button>
            <button type="button" className="botao-secundario" onClick={converter}>Converter em venda</button>
          </div>
        )}
      </form>
    </section>
  )
}
