import { useEffect, useState } from 'react'
import { formatarMoeda } from '../../utils/formatar'
import { mascaraDecimal, desfazerMascaraDecimal } from '../../utils/validacoes'

type ContaFinanceira = {
  id: number
  nome: string
  tipo: 'caixa' | 'banco' | 'cartao'
  saldo_inicial: string
  saldo_atual: string
  ativo: 0 | 1
}

const LABELS_TIPO: Record<ContaFinanceira['tipo'], string> = {
  caixa: 'Caixa (dinheiro)',
  banco: 'Banco',
  cartao: 'Cartão',
}

const VAZIO = { nome: '', tipo: 'banco' as ContaFinanceira['tipo'], saldo_inicial: '0,00', ativo: true }

export function ContasFinanceiras() {
  const [lista, setLista] = useState<ContaFinanceira[]>([])
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState(VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function carregar() {
    fetch('/api/contas-financeiras', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLista(d.contas ?? []))
      .catch(() => setErro('Erro ao carregar contas financeiras.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  function novo() {
    setEditandoId(null)
    setForm(VAZIO)
    setErro(null)
    setMsg(null)
  }

  function editar(c: ContaFinanceira) {
    setEditandoId(c.id)
    setForm({ nome: c.nome, tipo: c.tipo, saldo_inicial: mascaraDecimal(String(Math.round(Number(c.saldo_inicial) * 100))), ativo: !!c.ativo })
    setErro(null)
    setMsg(null)
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    setSalvando(true)
    setErro(null)
    try {
      const corpo = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        saldo_inicial: desfazerMascaraDecimal(form.saldo_inicial),
        ativo: form.ativo,
      }
      const res = await fetch(editandoId ? `/api/contas-financeiras/${editandoId}` : '/api/contas-financeiras', {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(corpo),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar.'); return }
      setMsg(editandoId ? 'Conta atualizada.' : 'Conta criada.')
      novo()
      carregar()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(c: ContaFinanceira) {
    if (!confirm(`Remover a conta "${c.nome}"?`)) return
    setErro(null)
    const res = await fetch(`/api/contas-financeiras/${c.id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { setLista((l) => l.filter((x) => x.id !== c.id)); return }
    const d = await res.json().catch(() => null)
    setErro(d?.erro ?? 'Erro ao remover conta.')
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Contas financeiras</h2>
      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        Destinos reais do dinheiro (caixa, bancos, cartões) usados nos recebimentos e pagamentos — permite conciliar o saldo de cada conta.
      </p>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div className="painel-mestre-detalhe" style={{ gridTemplateColumns: '320px 1fr' }}>
        <div>
          <button className="botao" type="button" onClick={novo} style={{ width: '100%', marginBottom: '10px' }}>
            + Nova conta
          </button>
          <div className="tabela-wrapper">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Saldo atual</th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr><td colSpan={2} style={{ textAlign: 'center' }}>Nenhuma conta cadastrada.</td></tr>
                )}
                {lista.map((c) => (
                  <tr key={c.id} style={{ background: editandoId === c.id ? 'var(--bg-alt)' : undefined }}>
                    <td onClick={() => editar(c)} style={{ cursor: 'pointer' }}>
                      {c.nome}
                      <span style={{ fontSize: '11px', color: 'var(--text)' }}> ({LABELS_TIPO[c.tipo]})</span>
                      {!c.ativo && <span className="badge badge-inativo" style={{ marginLeft: '6px', fontSize: '10px' }}>inativa</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarMoeda(c.saldo_atual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
            <div className="campo">
              <label>Nome *</label>
              <input className="sem-uppercase" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Banco Bradesco CC 1234" />
            </div>
            <div className="campo">
              <label>Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as ContaFinanceira['tipo'] }))}>
                <option value="caixa">Caixa (dinheiro)</option>
                <option value="banco">Banco</option>
                <option value="cartao">Cartão</option>
              </select>
            </div>
            <div className="campo">
              <label>Saldo inicial</label>
              <input
                inputMode="numeric"
                value={form.saldo_inicial}
                onChange={(e) => setForm((f) => ({ ...f, saldo_inicial: mascaraDecimal(e.target.value) }))}
              />
            </div>
          </div>

          {editandoId && (
            <label className="opcao-checkbox" style={{ marginBottom: '12px' }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
              Conta ativa
            </label>
          )}

          <div className="barra-acoes-formulario">
            {editandoId && (
              <>
                <button
                  className="botao-perigo"
                  type="button"
                  onClick={() => remover(lista.find((c) => c.id === editandoId)!)}
                  style={{ marginRight: 'auto' }}
                >
                  Remover conta
                </button>
                <button className="botao-secundario" type="button" onClick={novo}>Cancelar</button>
              </>
            )}
            <button className="botao" type="button" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar conta'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
