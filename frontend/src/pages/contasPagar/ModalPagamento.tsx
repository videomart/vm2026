import { useEffect, useState } from 'react'
import { formatarMoeda } from '../../utils/formatar'
import { mascaraDecimal, desfazerMascaraDecimal } from '../../utils/validacoes'

type Pagamento = {
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
  totalPago: number
  moedaConta: string
  onFechar: () => void
  onAtualizado: () => void
}

const MOEDAS = ['BRL', 'USD', 'EUR']

export function ModalPagamento({ contaId, valorTotal, totalPago, moedaConta, onFechar, onAtualizado }: Props) {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
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

  const saldoRestante = valorTotal - totalPago

  function carregar() {
    fetch(`/api/contas-pagar/${contaId}/pagamentos`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setPagamentos(d.pagamentos ?? []))
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
      const res = await fetch(`/api/contas-pagar/${contaId}/pagamentos`, {
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
      if (!res.ok) { setErro(d.erro ?? 'Erro ao registrar pagamento.'); return }
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
    if (!confirm('Remover este pagamento?')) return
    await fetch(`/api/contas-pagar/${contaId}/pagamentos/${id}`, { method: 'DELETE', credentials: 'include' })
    carregar()
    onAtualizado()
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-cabecalho">
          <h3>Pagamentos</h3>
          <button className="modal-fechar" type="button" onClick={onFechar}>×</button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>
          Valor total: <strong style={{ color: 'var(--text-h)' }}>{formatarMoeda(valorTotal)} {moedaConta}</strong>
          {' · '}
          Pago: <strong style={{ color: 'var(--text-h)' }}>{formatarMoeda(totalPago)} {moedaConta}</strong>
          {' · '}
          Saldo: <strong style={{ color: saldoRestante > 0 ? 'var(--perigo)' : 'var(--sucesso)' }}>{formatarMoeda(saldoRestante)} {moedaConta}</strong>
        </p>

        {erro && <p className="alerta-erro" role="alert">{erro}</p>}

        {!carregando && pagamentos.length > 0 && (
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
                {pagamentos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.data_pagamento.slice(0, 10).split('-').reverse().join('/')}</td>
                    <td>
                      {formatarMoeda(p.valor)} {p.moeda}
                      {p.cotacao && <span style={{ fontSize: '11px', color: 'var(--text)' }}> (cot. {Number(p.cotacao).toFixed(4)})</span>}
                    </td>
                    <td>{p.conta_financeira_nome ?? '—'}</td>
                    <td>{p.forma_pagamento ?? '—'}</td>
                    <td>
                      <button className="botao-perigo" type="button" onClick={() => remover(p.id)} style={{ padding: '2px 8px', fontSize: '11px' }}>
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
            <h4 style={{ fontSize: '13px', marginBottom: '10px' }}>Registrar novo pagamento</h4>
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
                <label>Conta financeira (origem)</label>
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
                {salvando ? 'Salvando...' : 'Registrar pagamento'}
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
