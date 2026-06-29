import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatarMoeda } from '../../utils/formatar'
import type { Cliente } from '../clientes/types'
import type { OportunidadeDetalhe, StatusOportunidade } from './types'

const LABELS_STATUS: Record<StatusOportunidade, string> = {
  prospeccao: 'Prospecção',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
  ganha: 'Ganha',
  perdida: 'Perdida',
  pos_venda: 'Pós-venda',
}

export function FormularioOportunidade() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = id !== undefined && /^\d+$/.test(id)

  const [oportunidade, setOportunidade] = useState<OportunidadeDetalhe | null>(null)
  const [titulo, setTitulo] = useState('')
  const [valorEstimado, setValorEstimado] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [resultadoBuscaCliente, setResultadoBuscaCliente] = useState<Cliente[]>([])
  const buscaClienteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [carregando, setCarregando] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  useEffect(() => {
    if (!buscaCliente.trim()) { setResultadoBuscaCliente([]); return }
    if (buscaClienteTimer.current) clearTimeout(buscaClienteTimer.current)
    buscaClienteTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/clientes?q=${encodeURIComponent(buscaCliente)}`, { credentials: 'include' })
        const d = await r.json()
        setResultadoBuscaCliente((d.clientes ?? []).slice(0, 15))
      } catch {
        // silencioso
      }
    }, 300)
    return () => { if (buscaClienteTimer.current) clearTimeout(buscaClienteTimer.current) }
  }, [buscaCliente])

  useEffect(() => {
    if (!editando || !id) { setCarregando(false); return }
    fetch(`/api/oportunidades/${id}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setOportunidade(data.oportunidade)
        setTitulo(data.oportunidade.titulo)
        setValorEstimado(data.oportunidade.valor_estimado ?? '')
      })
      .catch(() => setErro('Oportunidade não encontrada.'))
      .finally(() => setCarregando(false))
  }, [id, editando])

  function onClienteChange(cliente: Cliente) {
    setClienteId(String(cliente.id))
    setClienteSelecionado(cliente)
    setBuscaCliente('')
    setResultadoBuscaCliente([])
    if (!titulo) setTitulo(cliente.razao_social)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      const body = editando
        ? { titulo, valor_estimado: Number(valorEstimado) || null }
        : { cliente_id: Number(clienteId), titulo, valor_estimado: Number(valorEstimado) || null }

      const res = await fetch(editando ? `/api/oportunidades/${id}` : '/api/oportunidades', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Não foi possível salvar.'); return }
      navigate('/oportunidades')
    } catch {
      setErro('Erro de conexão com o servidor.')
    } finally {
      setSalvando(false)
    }
  }

  async function moverParaPosVenda() {
    const res = await fetch(`/api/oportunidades/${id}/pos-venda`, { method: 'POST', credentials: 'include' })
    const d = await res.json()
    if (!res.ok) { setErro(d.erro); return }
    setMensagem('Oportunidade movida para pós-venda.')
    setOportunidade((prev) => prev ? { ...prev, status: 'pos_venda' } : prev)
  }

  async function marcarComoPerdida() {
    const motivo = window.prompt('Motivo da perda (opcional):', '')
    if (motivo === null) return
    const res = await fetch(`/api/oportunidades/${id}/perder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ motivo }),
    })
    const d = await res.json()
    if (!res.ok) { setErro(d.erro); return }
    setMensagem('Oportunidade marcada como perdida.')
    setOportunidade((prev) => prev ? { ...prev, status: 'perdida', motivo_perda: motivo || null } : prev)
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>{editando ? `Oportunidade #${id}` : 'Nova oportunidade'}</h2>

      {mensagem && <p className="alerta-sucesso" role="status">{mensagem}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <form onSubmit={handleSubmit}>
        <div className="grade-formulario">
          {!editando && (
            <div className="campo campo-largo">
              <label htmlFor="cliente_busca">Cliente *</label>
              {!clienteId && (
                <div style={{ position: 'relative' }}>
                  <input
                    id="cliente_busca"
                    placeholder="Digite razão social, contato ou e-mail para buscar..."
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value.toUpperCase())}
                    autoComplete="off"
                    required
                  />
                  {resultadoBuscaCliente.length > 0 && (
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '4px', maxHeight: '220px', overflowY: 'auto', position: 'absolute', width: '100%', zIndex: 10 }}>
                      {resultadoBuscaCliente.map((c) => (
                        <div
                          key={c.id}
                          style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                          onClick={() => onClienteChange(c)}
                        >
                          {c.razao_social}{c.nome_fantasia ? ` / ${c.nome_fantasia}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {clienteId && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--raio)', background: 'var(--bg-elevado)' }}>
                    {clienteSelecionado?.razao_social}
                  </div>
                  <button type="button" className="botao-secundario" onClick={() => { setClienteId(''); setClienteSelecionado(null) }}>
                    Trocar
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="campo campo-largo">
            <label htmlFor="titulo">Título *</label>
            <input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </div>

          <div className="campo">
            <label htmlFor="valor_estimado">Valor estimado (R$)</label>
            <input
              id="valor_estimado"
              type="number" min="0" step="0.01"
              value={valorEstimado}
              onChange={(e) => setValorEstimado(e.target.value)}
            />
          </div>

          {oportunidade && (
            <div className="campo">
              <label>Status</label>
              <div style={{ padding: '8px 12px' }}>{LABELS_STATUS[oportunidade.status]}</div>
            </div>
          )}
        </div>

        {oportunidade && oportunidade.propostas.length > 0 && (
          <div style={{ margin: '1rem 0' }}>
            <strong>Propostas vinculadas</strong>
            <ul>
              {oportunidade.propostas.map((p) => (
                <li key={p.id}>
                  <Link to={`/propostas/${p.id}`}>#{p.id}</Link> — {p.status} — {formatarMoeda(p.total)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="barra-acoes-formulario">
          <button className="botao" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button className="botao-secundario" type="button" onClick={() => navigate('/oportunidades')}>
            Cancelar
          </button>
          {oportunidade?.status === 'ganha' && (
            <button type="button" className="botao-secundario" onClick={moverParaPosVenda}>
              Mover para Pós-venda
            </button>
          )}
          {oportunidade && !['ganha', 'perdida', 'pos_venda'].includes(oportunidade.status) && (
            <button type="button" className="botao-perigo" onClick={marcarComoPerdida}>
              Marcar como perdida
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
