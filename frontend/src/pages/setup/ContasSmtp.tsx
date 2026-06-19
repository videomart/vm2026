import { useEffect, useState } from 'react'

type Conta = {
  id: number
  nome: string
  host: string
  port: number
  secure: boolean
  smtp_user: string
  smtp_from: string | null
  reply_to: string | null
  limite_dia: number
  ativo: boolean
  usado_hoje: number
}

const VAZIO = {
  nome: '', host: 'smtp.hostinger.com', port: '465', secure: true,
  smtp_user: '', smtp_pass: '', smtp_from: '', reply_to: '', limite_dia: '100',
}

export function ContasSmtp() {
  const [lista, setLista] = useState<Conta[]>([])
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState(VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function carregar() {
    fetch('/api/contas-smtp', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLista(d.contas ?? []))
      .catch(() => setErro('Erro ao carregar contas SMTP.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  function nova() {
    setEditandoId(null)
    setForm(VAZIO)
    setErro(null)
    setMsg(null)
  }

  function editar(c: Conta) {
    setEditandoId(c.id)
    setForm({
      nome: c.nome, host: c.host, port: String(c.port), secure: c.secure,
      smtp_user: c.smtp_user, smtp_pass: '', smtp_from: c.smtp_from ?? '',
      reply_to: c.reply_to ?? '', limite_dia: String(c.limite_dia),
    })
    setErro(null)
    setMsg(null)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.host.trim() || !form.smtp_user.trim()) {
      setErro('Nome, host e usuário SMTP são obrigatórios.')
      return
    }
    if (!editandoId && !form.smtp_pass.trim()) {
      setErro('Senha é obrigatória ao criar uma nova conta.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(editandoId ? `/api/contas-smtp/${editandoId}` : '/api/contas-smtp', {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, ativo: true }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar.'); return }
      setMsg(editandoId ? 'Conta atualizada.' : 'Conta criada.')
      nova()
      carregar()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(c: Conta) {
    await fetch(`/api/contas-smtp/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        nome: c.nome, host: c.host, port: c.port, secure: c.secure,
        smtp_user: c.smtp_user, smtp_from: c.smtp_from, reply_to: c.reply_to,
        limite_dia: c.limite_dia, ativo: !c.ativo,
      }),
    })
    carregar()
  }

  async function remover(id: number, nome: string) {
    if (!confirm(`Remover a conta "${nome}"?`)) return
    setErro(null)
    try {
      const res = await fetch(`/api/contas-smtp/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => null); setErro(d?.erro ?? 'Erro ao remover.'); return }
      if (editandoId === id) nova()
      setLista((l) => l.filter((x) => x.id !== id))
    } catch {
      setErro('Erro de conexão ao remover.')
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Contas SMTP (envio de campanhas)</h2>
      <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px' }}>
        Cadastre as caixas de e-mail usadas para disparo de campanhas. O sistema distribui
        os destinatários em rotação entre as contas ativas, respeitando o limite diário de
        cada uma (ex.: Hostinger limita 100 e-mails/dia por caixa postal).
      </p>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      <div className="painel-mestre-detalhe" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Lista */}
        <div>
          <button className="botao" type="button" onClick={nova} style={{ width: '100%', marginBottom: '10px' }}>
            + Nova conta
          </button>
          <div className="tabela-wrapper">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>Hoje</th>
                  <th>Status</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center' }}>Nenhuma conta cadastrada.</td></tr>
                )}
                {lista.map((c) => (
                  <tr key={c.id} style={{ background: editandoId === c.id ? 'var(--bg-alt)' : undefined }}>
                    <td onClick={() => editar(c)} style={{ cursor: 'pointer' }}>
                      {c.nome}<br />
                      <span style={{ fontSize: '11px', color: 'var(--text)' }}>{c.smtp_user}</span>
                    </td>
                    <td>{c.usado_hoje}/{c.limite_dia}</td>
                    <td>
                      <button
                        className={c.ativo ? 'badge badge-sucesso' : 'badge badge-inativo'}
                        type="button"
                        onClick={() => alternarAtivo(c)}
                        style={{ border: 'none', cursor: 'pointer' }}
                      >
                        {c.ativo ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td>
                      <button className="botao-perigo" type="button" onClick={() => remover(c.id, c.nome)} style={{ fontSize: '11px', padding: '2px 8px' }}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Formulário */}
        <div>
          <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="campo">
              <label>Nome (identificação interna)</label>
              <input className="sem-uppercase" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Caixa A" />
            </div>
            <div className="campo">
              <label>Limite de envios/dia</label>
              <input type="number" min="1" max="10000" value={form.limite_dia} onChange={(e) => setForm((f) => ({ ...f, limite_dia: e.target.value }))} />
            </div>
          </div>
          <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 90px 110px' }}>
            <div className="campo">
              <label>Servidor SMTP</label>
              <input className="sem-uppercase" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
            </div>
            <div className="campo">
              <label>Porta</label>
              <input type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} />
            </div>
            <div className="campo">
              <label>SSL/TLS</label>
              <select value={form.secure ? '1' : '0'} onChange={(e) => setForm((f) => ({ ...f, secure: e.target.value === '1' }))}>
                <option value="1">Sim (465)</option>
                <option value="0">Não (587)</option>
              </select>
            </div>
          </div>
          <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="campo">
              <label>Usuário / E-mail remetente *</label>
              <input className="sem-uppercase" value={form.smtp_user} onChange={(e) => setForm((f) => ({ ...f, smtp_user: e.target.value }))} placeholder="a@avideomart.com.br" />
            </div>
            <div className="campo">
              <label>Senha {editandoId && <span style={{ fontSize: '11px', fontWeight: 400 }}>(deixe vazio para manter)</span>}</label>
              <input type="password" autoComplete="new-password" value={form.smtp_pass} onChange={(e) => setForm((f) => ({ ...f, smtp_pass: e.target.value }))} />
            </div>
          </div>
          <div className="grade-formulario">
            <div className="campo campo-largo">
              <label>Nome de exibição (From)</label>
              <input className="sem-uppercase" value={form.smtp_from} onChange={(e) => setForm((f) => ({ ...f, smtp_from: e.target.value }))} placeholder='Videomart Broadcast <a@avideomart.com.br>' />
            </div>
          </div>
          <div className="grade-formulario">
            <div className="campo campo-largo">
              <label>Reply-To (opcional)</label>
              <input className="sem-uppercase" value={form.reply_to} onChange={(e) => setForm((f) => ({ ...f, reply_to: e.target.value }))} placeholder="comercial@videomart.com.br" />
              <span style={{ fontSize: '12px', color: 'var(--text)' }}>
                Respostas do destinatário vão para este endereço, mesmo que o e-mail tenha sido enviado por esta caixa.
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
            {editandoId && <button className="botao-secundario" type="button" onClick={nova}>Cancelar</button>}
            <button className="botao" type="button" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar conta'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
