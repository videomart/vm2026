import { useEffect, useState } from 'react'
import { formatarMoeda } from '../../utils/formatar'

type Recebimento = {
  id: number
  valor: string
  data_pagamento: string
  forma_pagamento: string | null
  observacao: string | null
}

type Props = {
  contaId: number
  valorTotal: number
  totalRecebido: number
  onFechar: () => void
  onAtualizado: () => void
}

export function ModalRecebimento({ contaId, valorTotal, totalRecebido, onFechar, onAtualizado }: Props) {
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [valor, setValor] = useState('')
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10))
  const [formaPagamento, setFormaPagamento] = useState('')
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

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    if (!valor || Number(valor) <= 0) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/contas-receber/${contaId}/recebimentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ valor: Number(valor), data_pagamento: dataPagamento, forma_pagamento: formaPagamento, observacao }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao registrar recebimento.'); return }
      setValor('')
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
      <div className="modal-caixa" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-cabecalho">
          <h3>Recebimentos</h3>
          <button className="modal-fechar" type="button" onClick={onFechar}>×</button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>
          Valor total: <strong style={{ color: 'var(--text-h)' }}>{formatarMoeda(valorTotal)}</strong>
          {' · '}
          Recebido: <strong style={{ color: 'var(--text-h)' }}>{formatarMoeda(totalRecebido)}</strong>
          {' · '}
          Saldo: <strong style={{ color: saldoRestante > 0 ? 'var(--perigo)' : 'var(--sucesso)' }}>{formatarMoeda(saldoRestante)}</strong>
        </p>

        {erro && <p className="alerta-erro" role="alert">{erro}</p>}

        {!carregando && recebimentos.length > 0 && (
          <div className="tabela-wrapper" style={{ marginBottom: '16px' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Forma</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {recebimentos.map((r) => (
                  <tr key={r.id}>
                    <td>{r.data_pagamento.slice(0, 10).split('-').reverse().join('/')}</td>
                    <td>{formatarMoeda(r.valor)}</td>
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
            <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="campo">
                <label>Valor *</label>
                <input
                  type="number"
                  min="0.01"
                  max={saldoRestante}
                  step="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder={`até ${formatarMoeda(saldoRestante)}`}
                  required
                />
              </div>
              <div className="campo">
                <label>Data do pagamento *</label>
                <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} required />
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
