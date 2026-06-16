import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dataParaInput } from '../../utils/formatar'
import { useNavegacaoRegistro } from '../../hooks/useNavegacaoRegistro'
import { NavegadorRegistro } from '../../components/NavegadorRegistro'
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

function stripHtml(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .replace(/<[^>]+>/g, ' ')       // remove tags HTML
    .replace(/&[a-z]+;/gi, ' ')     // remove entidades HTML (&nbsp; etc.)
    .replace(/&#\d+;/g, ' ')        // remove entidades numéricas
    .replace(/\s{2,}/g, ' ')        // colapsa múltiplos espaços
    .trim()
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
  const [listaCondicoes, setListaCondicoes] = useState<{ id: number; descricao: string; corpo: string | null }[]>([])
  const [validadeDias, setValidadeDias] = useState(30)

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

  async function recarregarClientes() {
    const res = await fetch('/api/clientes', { credentials: 'include' })
    const data = await res.json()
    setClientes(data.clientes ?? [])
  }

  // recarrega lista de clientes ao retornar de aba de novo cliente
  useEffect(() => {
    function onFocus() { recarregarClientes() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // carrega dados auxiliares + proposta (se editando)
  useEffect(() => {
    async function init() {
      try {
        const [resMe, resClientes, resProdutos, resUsuarios, resCondicoes, resSetup] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/clientes', { credentials: 'include' }),
          fetch('/api/produtos', { credentials: 'include' }),
          fetch('/api/auth/usuarios', { credentials: 'include' }),
          fetch('/api/setup/condicoes', { credentials: 'include' }),
          fetch('/api/setup', { credentials: 'include' }),
        ])
        const [me, clientesData, produtosData, usuariosData, condicoesData, setupData] = await Promise.all([
          resMe.json(), resClientes.json(), resProdutos.json(), resUsuarios.json(), resCondicoes.json(), resSetup.json(),
        ])

        const dias = Number(setupData?.setup?.proposta_validade_dias ?? 30)
        setValidadeDias(dias)
        setUsuarioAtual(me.usuario)
        setClientes(clientesData.clientes ?? [])
        setProdutos(produtosData.produtos ?? [])
        setUsuarios(usuariosData.usuarios ?? [])
        setListaCondicoes(condicoesData.condicoes ?? [])

        if (me.usuario) {
          setVendedorId(String(me.usuario.id))
        }

        // validade e observações padrão para nova proposta
        if (!editando) {
          if (dias > 0) {
            const v = new Date()
            v.setDate(v.getDate() + dias)
            setValidade(v.toISOString().slice(0, 10))
          }
          const obsPadrao = setupData?.setup?.observacoes_padrao ?? ''
          if (obsPadrao) setObservacoes(obsPadrao)
        }

        if (editando && id) {
          const res = await fetch(`/api/propostas/${id}`, { credentials: 'include' })
          if (!res.ok) { setErro('Proposta não encontrada.'); return }
          const { proposta: p } = await res.json()
          setProposta(p)
          setClienteId(String(p.cliente_id))
          setVendedorId(String(p.vendedor_id))
          setData(dataParaInput(p.data))
          setValidade(dataParaInput(p.validade))
          setCondicoes(stripHtml(p.condicoes_pagamento))
          setObservacoes(stripHtml(p.observacoes))
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

  function validadeParaData(dataStr: string, dias: number): string {
    const d = new Date(dataStr + 'T12:00:00')
    d.setDate(d.getDate() + dias)
    return d.toISOString().slice(0, 10)
  }

  function onDataChange(novaData: string) {
    setData(novaData)
    if (!editando && validadeDias > 0) {
      setValidade(validadeParaData(novaData, validadeDias))
    }
  }

  function onClienteChange(novoClienteId: string) {
    setClienteId(novoClienteId)
    const cliente = clientes.find((c) => String(c.id) === novoClienteId)
    if (cliente?.condicoes_pagamento) {
      // tenta encontrar o corpo da condição cadastrada que casa com a do cliente
      const cond = listaCondicoes.find((c) => c.descricao === cliente.condicoes_pagamento)
      setCondicoes(cond?.corpo ?? cliente.condicoes_pagamento)
    }
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

  const nav = useNavegacaoRegistro('nav_propostas', id, '/propostas')

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      {editando && (
        <NavegadorRegistro
          temAnterior={nav.temAnterior}
          temProximo={nav.temProximo}
          posicao={nav.posicao}
          total={nav.total}
          onAnterior={nav.irAnterior}
          onProximo={nav.irProximo}
          label="Proposta"
        />
      )}
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

          {/* Linha 1: Cliente (span 2) + Vendedor */}
          <div className="campo" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="cliente_id">Cliente *</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                id="cliente_id"
                value={clienteId}
                onChange={(e) => onClienteChange(e.target.value)}
                required
                disabled={somenteLeitura}
                style={{ flex: 1 }}
              >
                <option value="">— Selecione —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.razao_social}{c.nome_fantasia ? ` / ${c.nome_fantasia}` : ''}</option>
                ))}
              </select>
              {!somenteLeitura && (
                <button
                  type="button"
                  className="botao-secundario"
                  title="Cadastrar novo cliente"
                  onClick={() => window.open('/clientes/novo', '_blank')}
                  style={{ whiteSpace: 'nowrap', alignSelf: 'stretch' }}
                >+ Cliente</button>
              )}
            </div>
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

          {/* Linha 2: Data com validade no label + espaço */}
          <div className="campo">
            <label htmlFor="data">
              Data *
              {validade && (
                <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text)', marginLeft: '8px' }}>
                  válida até {validade.split('-').reverse().join('/')}
                </span>
              )}
            </label>
            <input id="data" type="date" value={data} onChange={(e) => onDataChange(e.target.value)} required disabled={somenteLeitura} />
          </div>

          {/* Linha 3: Condições + Observações — cada uma metade da linha */}
          <div className="campo campo-largo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="campo" style={{ marginBottom: 0 }}>
              <label htmlFor="condicoes">Condições de pagamento</label>
              {!somenteLeitura && (
                <select
                  id="condicoes-select"
                  value=""
                  onChange={(e) => {
                    const cond = listaCondicoes.find((c) => String(c.id) === e.target.value)
                    if (cond?.corpo) setCondicoes(cond.corpo)
                    else if (cond) setCondicoes(cond.descricao)
                  }}
                  style={{ marginBottom: '4px' }}
                >
                  <option value="">— Selecionar modelo —</option>
                  {listaCondicoes.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </select>
              )}
              <textarea
                id="condicoes"
                rows={6}
                value={condicoes}
                onChange={(e) => setCondicoes(e.target.value)}
                disabled={somenteLeitura}
                placeholder="Selecione um modelo acima ou escreva livremente"
              />
            </div>
            <div className="campo" style={{ marginBottom: 0 }}>
              <label htmlFor="observacoes">Observações</label>
              <textarea
                id="observacoes"
                rows={somenteLeitura ? 6 : 7}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={somenteLeitura}
              />
            </div>
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
            <a
              className="botao-secundario"
              href={`/propostas/${proposta.id}/imprimir`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}
            >
              🖨 Imprimir
            </a>
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
