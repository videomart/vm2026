import { useEffect, useState } from 'react'
import { formatarMoeda } from '../../utils/formatar'
import { mascaraDecimal, desfazerMascaraDecimal } from '../../utils/validacoes'

type Recebimento = {
  id: number
  valor: string
  moeda: string
  cotacao: string | null
  data_pagamento: string
  forma_pagamento: string | null
  conta_financeira_nome: string | null
  observacao: string | null
}

type ContaFinanceira = { id: number; nome: string; tipo: string }

type Props = {
  contaId: number
  valorTotal: number
  totalRecebido: number
  moedaConta: string
  onFechar: () => void
  onAtualizado: () => void
}

const MOEDAS = ['BRL', 'USD', 'EUR']

export function ModalRecebimento({ contaId, valorTotal, totalRecebido, moedaConta, onFechar, onAtualizado }: Props) {
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([])
  const [carregando, setCarregando] = useState(true)
  const [valor, setValor] = useState('')
  const [moeda, setMoeda] = useState(moedaConta)
  const [cotacao, setCotacao] = useState('')
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10))
  const [formaPagamento, setFormaPagamento] = useState('')
  const [contaFinanceiraId, setContaFinanceiraId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const saldoRestante = valorTotal - totalRecebido

  function carregar() {
    fetch(`/api/contas-receber/${contaId}/recebimentos`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRecebimentos(d.recebimentos ?? []))
      .finally(() => setCarregando(false))
  }

  useEffect(() => {
    carregar()
    fetch('/api/contas-financeiras?ativas=1', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setContasFinanceiras(d.contas ?? []))
      .catch(() => null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    const valorNumerico = desfazerMascaraDecimal(valor)
    if (!valorNumerico || valorNumerico <= 0) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/contas-receber/${contaId}/recebimentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          valor: valorNumerico,
          moeda,
          cotacao: moeda !== moedaConta ? Number(cotacao) : null,
          data_pagamento: dataPagamento,
          forma_pagamento: formaPagamento,
          conta_financeira_id: contaFinanceiraId || null,
          observacao,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao registrar recebimento.'); return }
      setValor('')
      setCotacao('')
      setFormaPagamento('')
      setObservacao('')
      carregar()
      onAtualizado()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: number) {
    if (!confirm('Remover este recebimento?')) return
    await fetch(`/api/contas-receber/${contaId}/recebimentos/${id}`, { method: 'DELETE', credentials: 'include' })
    carregar()
    onAtualizado()
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-cabecalho">
          <h3>Recebimentos</h3>
          <button className="modal-fechar" type="button" onClick={onFechar}>×</button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>
          Valor total: <strong style={{ color: 'var(--text-h)' }}>{formatarMoeda(valorTotal)} {moedaConta}</strong>
          {' · '}
          Recebido: <strong style={{ color: 'var(--text-h)' }}>{formatarMoeda(totalRecebido)} {moedaConta}</strong>
          {' · '}
          Saldo: <strong style={{ color: saldoRestante > 0 ? 'var(--perigo)' : 'var(--sucesso)' }}>{formatarMoeda(saldoRestante)} {moedaConta}</strong>
        </p>

        {erro && <p className="alerta-erro" role="alert">{erro}</p>}

        {!carregando && recebimentos.length > 0 && (
          <div className="tabela-wrapper" style={{ marginBottom: '16px' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Conta</th>
                  <th>Forma</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {recebimentos.map((r) => (
                  <tr key={r.id}>
                    <td>{r.data_pagamento.slice(0, 10).split('-').reverse().join('/')}</td>
                    <td>
                      {formatarMoeda(r.valor)} {r.moeda}
                      {r.cotacao && <span style={{ fontSize: '11px', color: 'var(--text)' }}> (cot. {Number(r.cotacao).toFixed(4)})</span>}
                    </td>
                    <td>{r.conta_financeira_nome ?? '—'}</td>
                    <td>{r.forma_pagamento ?? '—'}</td>
                    <td>
                      <button className="botao-perigo" type="button" onClick={() => remover(r.id)} style={{ padding: '2px 8px', fontSize: '11px' }}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {saldoRestante > 0.01 ? (
          <form onSubmit={registrar}>
            <h4 style={{ fontSize: '13px', marginBottom: '10px' }}>Registrar novo recebimento</h4>
            <div className="grade-formulario" style={{ gridTemplateColumns: moeda !== moedaConta ? '1fr 1fr 1fr' : '1fr 1fr' }}>
              <div className="campo">
                <label>Valor *</label>
                <input
                  inputMode="numeric"
                  value={valor}
                  onChange={(e) => setValor(mascaraDecimal(e.target.value))}
                  placeholder={`até ${formatarMoeda(saldoRestante)}`}
                  required
                />
              </div>
              <div className="campo">
                <label>Moeda</label>
                <select value={moeda} onChange={(e) => setMoeda(e.target.value)}>
                  {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {moeda !== moedaConta && (
                <div className="campo">
                  <label>Cotação ({moeda} → {moedaConta}) *</label>
                  <input type="number" min="0.0001" step="0.0001" value={cotacao} onChange={(e) => setCotacao(e.target.value)} placeholder="5.5000" required />
                </div>
              )}
            </div>
            <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="campo">
                <label>Data do pagamento *</label>
                <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} required />
              </div>
              <div className="campo">
                <label>Conta financeira (destino)</label>
                <select value={contaFinanceiraId} onChange={(e) => setContaFinanceiraId(e.target.value)}>
                  <option value="">—</option>
                  {contasFinanceiras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="campo">
                <label>Forma de pagamento</label>
                <input className="sem-uppercase" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} placeholder="PIX, boleto, transferência..." />
              </div>
              <div className="campo">
                <label>Observação</label>
                <input className="sem-uppercase" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="botao-secundario" type="button" onClick={onFechar}>Fechar</button>
              <button className="botao" type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Registrar recebimento'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <p className="alerta-sucesso" style={{ flex: 1, margin: 0 }}>Conta totalmente paga.</p>
            <button className="botao-secundario" type="button" onClick={onFechar}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  )
}
