import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type SetupData = {
  empresa_nome: string
  empresa_cnpj: string
  empresa_endereco: string
  empresa_telefone: string
  empresa_email: string
  empresa_site: string
  fator_markup_usd: string
  proposta_validade_dias: string
  observacoes_padrao: string
  envio_intervalo_segundos: string
  envio_lote_tamanho: string
  envio_lote_pausa_segundos: string
  lembrete_proposta_dias: string
}

const OBS_PADRAO = `O prazo de entrega está sujeito a alterações em caso de greve da Receita, Polícia Federal ou motivos não controlados pela Videomart Broadcast.
A empresa não se responsabiliza por danos ou atrasos causados pela transportadora ou fiscalização.
Prazo de entrega: 30 dias úteis
Período de garantia: 01 ANO
Condições de pagamento: 10 DIAS APÓS ENTREGA
Forma de pagamento: Depósito bancário
Validade da proposta: 3 dias
Inclusão de impostos: SIM
Instruções p/ depósito: BRADESCO AG.2546-1 C/C. 00010-8
Frete: Incluso
PREÇO FORNECIDO EM REAIS`

const SETUP_VAZIO: SetupData = {
  empresa_nome: '',
  empresa_cnpj: '',
  empresa_endereco: '',
  empresa_telefone: '',
  empresa_email: '',
  empresa_site: '',
  fator_markup_usd: '1.3',
  proposta_validade_dias: '30',
  observacoes_padrao: OBS_PADRAO,
  envio_intervalo_segundos: '10',
  envio_lote_tamanho: '25',
  envio_lote_pausa_segundos: '300',
  lembrete_proposta_dias: '3',
}

function paraForm(s: any): SetupData {
  return {
    empresa_nome: s.empresa_nome ?? '',
    empresa_cnpj: s.empresa_cnpj ?? '',
    empresa_endereco: s.empresa_endereco ?? '',
    empresa_telefone: s.empresa_telefone ?? '',
    empresa_email: s.empresa_email ?? '',
    empresa_site: s.empresa_site ?? '',
    fator_markup_usd: String(s.fator_markup_usd ?? '1.3'),
    proposta_validade_dias: String(s.proposta_validade_dias ?? '30'),
    observacoes_padrao: s.observacoes_padrao ?? OBS_PADRAO,
    envio_intervalo_segundos: String(s.envio_intervalo_segundos ?? '10'),
    envio_lote_tamanho: String(s.envio_lote_tamanho ?? '25'),
    envio_lote_pausa_segundos: String(s.envio_lote_pausa_segundos ?? '300'),
    lembrete_proposta_dias: String(s.lembrete_proposta_dias ?? '3'),
  }
}

const H3: React.CSSProperties = {
  marginBottom: '12px',
  marginTop: '28px',
  fontSize: '15px',
  color: 'var(--text-h)',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '6px',
}

export function Setup() {
  const [campos, setCampos] = useState<SetupData>(SETUP_VAZIO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [logoPdfPreview, setLogoPdfPreview] = useState<string | null>(null)
  const [logoInterfacePreview, setLogoInterfacePreview] = useState<string | null>(null)
  const [salvandoLogo, setSalvandoLogo] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/setup', { credentials: 'include' }),
      fetch('/api/setup/logo/pdf', { credentials: 'include' }),
      fetch('/api/setup/logo/interface', { credentials: 'include' }),
    ])
      .then(async ([rs, rloPdf, rloInterface]) => {
        const ds = await rs.json()
        if (ds.setup) setCampos(paraForm(ds.setup))
        if (rloPdf.ok) setLogoPdfPreview(URL.createObjectURL(await rloPdf.blob()))
        if (rloInterface.ok) setLogoInterfacePreview(URL.createObjectURL(await rloInterface.blob()))
      })
      .catch(() => setErro('Erro ao carregar configurações.'))
      .finally(() => setCarregando(false))
  }, [])

  function onLogoChange(variante: 'pdf' | 'interface', setPreview: (url: string | null) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        setPreview(base64)
        setSalvandoLogo(true)
        try {
          await fetch(`/api/setup/logo/${variante}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ logo_base64: base64 }),
          })
        } finally {
          setSalvandoLogo(false)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  async function removerLogo(variante: 'pdf' | 'interface', setPreview: (url: string | null) => void) {
    setSalvandoLogo(true)
    try {
      await fetch(`/api/setup/logo/${variante}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logo_base64: null }),
      })
      setPreview(null)
    } finally {
      setSalvandoLogo(false)
    }
  }

  function atualizar(campo: keyof SetupData, valor: string) {
    setCampos((c) => ({ ...c, [campo]: valor }))
  }

  async function salvarSetup(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)
    setErro(null)
    try {
      const res = await fetch('/api/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...campos,
          fator_markup_usd: Number(campos.fator_markup_usd),
          proposta_validade_dias: Number(campos.proposta_validade_dias),
          envio_intervalo_segundos: Number(campos.envio_intervalo_segundos),
          envio_lote_tamanho: Number(campos.envio_lote_tamanho),
          envio_lote_pausa_segundos: Number(campos.envio_lote_pausa_segundos),
          lembrete_proposta_dias: Number(campos.lembrete_proposta_dias),
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.erro ?? 'Erro ao salvar.'); return }
      setMsg('Configurações salvas.')
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <section>
      <h2>Configurações do sistema</h2>

      {msg && <p className="alerta-sucesso" role="status">{msg}</p>}
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {/* ── Dados da empresa ── */}
      <form onSubmit={salvarSetup}>
        <h3 style={H3}>Dados da empresa</h3>

        <div className="grade-2col-responsiva" style={{ marginBottom: '16px' }}>
          {/* Logo do PDF (fundo branco) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {logoPdfPreview ? (
              <img src={logoPdfPreview} alt="Logo do PDF" style={{ maxHeight: '64px', maxWidth: '200px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px', background: '#fff' }} />
            ) : (
              <div style={{ width: '200px', height: '64px', border: '1px dashed var(--border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text)' }}>
                Sem logo
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <strong style={{ fontSize: '13px' }}>Logo do PDF de propostas</strong>
              <label className="botao-secundario" style={{ cursor: 'pointer', display: 'inline-block' }}>
                {salvandoLogo ? 'Salvando...' : 'Alterar logo'}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={onLogoChange('pdf', setLogoPdfPreview)} disabled={salvandoLogo} />
              </label>
              {logoPdfPreview && (
                <button type="button" className="botao-perigo" onClick={() => removerLogo('pdf', setLogoPdfPreview)} disabled={salvandoLogo} style={{ fontSize: '12px', padding: '4px 10px' }}>
                  Remover
                </button>
              )}
              <span style={{ fontSize: '11px', color: 'var(--text)' }}>Fundo branco (impressão). PNG, JPG ou SVG. Até 400×100px.</span>
            </div>
          </div>

          {/* Logo da interface (fundo escuro) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {logoInterfacePreview ? (
              <img src={logoInterfacePreview} alt="Logo da interface" style={{ maxHeight: '64px', maxWidth: '200px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px', background: 'var(--bg-suave)' }} />
            ) : (
              <div style={{ width: '200px', height: '64px', border: '1px dashed var(--border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text)' }}>
                Sem logo
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <strong style={{ fontSize: '13px' }}>Logo da interface (sidebar, login)</strong>
              <label className="botao-secundario" style={{ cursor: 'pointer', display: 'inline-block' }}>
                {salvandoLogo ? 'Salvando...' : 'Alterar logo'}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={onLogoChange('interface', setLogoInterfacePreview)} disabled={salvandoLogo} />
              </label>
              {logoInterfacePreview && (
                <button type="button" className="botao-perigo" onClick={() => removerLogo('interface', setLogoInterfacePreview)} disabled={salvandoLogo} style={{ fontSize: '12px', padding: '4px 10px' }}>
                  Remover
                </button>
              )}
              <span style={{ fontSize: '11px', color: 'var(--text)' }}>Fundo escuro (tema da aplicação) — use uma versão clara/branca da logo. PNG, JPG ou SVG.</span>
            </div>
          </div>
        </div>

        <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <div className="campo">
            <label>Razão social</label>
            <input value={campos.empresa_nome} onChange={(e) => atualizar('empresa_nome', e.target.value)} required />
          </div>
          <div className="campo">
            <label>CNPJ</label>
            <input value={campos.empresa_cnpj} onChange={(e) => atualizar('empresa_cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className="campo">
            <label>Telefone</label>
            <input value={campos.empresa_telefone} onChange={(e) => atualizar('empresa_telefone', e.target.value)} />
          </div>
        </div>
        <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <div className="campo">
            <label>Endereço</label>
            <input value={campos.empresa_endereco} onChange={(e) => atualizar('empresa_endereco', e.target.value)} />
          </div>
          <div className="campo">
            <label>E-mail</label>
            <input type="email" value={campos.empresa_email} onChange={(e) => atualizar('empresa_email', e.target.value)} />
          </div>
          <div className="campo">
            <label>Site</label>
            <input className="sem-uppercase" value={campos.empresa_site} onChange={(e) => atualizar('empresa_site', e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <h3 style={H3}>Propostas e precificação</h3>
        <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="campo">
            <label>Validade padrão (dias)</label>
            <input type="number" min="0" step="1" value={campos.proposta_validade_dias} onChange={(e) => atualizar('proposta_validade_dias', e.target.value)} />
          </div>
          <div className="campo">
            <label>Fator de markup sobre preço USD</label>
            <input type="number" min="1" step="0.01" value={campos.fator_markup_usd} onChange={(e) => atualizar('fator_markup_usd', e.target.value)} />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              Preço sugerido = preço USD × cotação do dia × fator. Ex.: 1,30 = 30% de margem.
            </span>
          </div>
          <div className="campo">
            <label>Lembrete de proposta parada (dias)</label>
            <input type="number" min="0" step="1" value={campos.lembrete_proposta_dias} onChange={(e) => atualizar('lembrete_proposta_dias', e.target.value)} />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              E-mail ao vendedor quando a proposta "aberta" fica esse tempo sem atividade. Repete a cada N dias. 0 desativa.
            </span>
          </div>
        </div>
        <div className="grade-formulario">
          <div className="campo campo-largo">
            <label>Observações padrão das propostas</label>
            <textarea
              className="sem-uppercase"
              rows={6}
              value={campos.observacoes_padrao}
              onChange={(e) => atualizar('observacoes_padrao', e.target.value)}
            />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              Preenchido automaticamente no campo Observações de novas propostas.
            </span>
          </div>
        </div>

        <h3 style={H3}>E-mail (SMTP)</h3>
        <p style={{ fontSize: '13px', color: 'var(--text)' }}>
          As contas de e-mail agora são configuradas em{' '}
          <Link to="/contas-smtp">Configurações → Contas SMTP</Link>. A conta marcada como
          "padrão" ali é usada para "esqueci minha senha" e envio individual de proposta;
          todas as contas ativas entram na rotação de campanhas em massa.
        </p>

        <h3 style={H3}>Ritmo de envio de campanhas</h3>
        <p style={{ fontSize: '12px', color: 'var(--text)', marginTop: '-6px', marginBottom: '10px' }}>
          Provedores (ex.: Hostinger) bloqueiam temporariamente o envio quando detectam muitos
          e-mails em sequência contínua ("ratelimit exceeded"). Duas proteções combinadas:
          pausa entre cada e-mail, e uma pausa mais longa a cada lote de N e-mails.
        </p>
        <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="campo">
            <label>Intervalo entre e-mails (segundos)</label>
            <input
              type="number" min="1" max="3600"
              value={campos.envio_intervalo_segundos}
              onChange={(e) => atualizar('envio_intervalo_segundos', e.target.value)}
            />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Recomendado: 30–60s para ser mais conservador.</span>
          </div>
          <div className="campo">
            <label>Tamanho do lote</label>
            <input
              type="number" min="0" max="1000"
              value={campos.envio_lote_tamanho}
              onChange={(e) => atualizar('envio_lote_tamanho', e.target.value)}
            />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Quantos e-mails enviar antes da pausa longa. 0 desativa (só usa o intervalo simples).</span>
          </div>
          <div className="campo">
            <label>Pausa entre lotes (segundos)</label>
            <input
              type="number" min="0" max="86400"
              value={campos.envio_lote_pausa_segundos}
              onChange={(e) => atualizar('envio_lote_pausa_segundos', e.target.value)}
            />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>Recomendado: 300–600s (5–10 min).</span>
          </div>
        </div>

        <div className="barra-acoes-formulario">
          <button className="botao" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </form>

      <p style={{ fontSize: '13px', color: 'var(--text)' }}>
        A cotação do dólar agora é cadastrada em <Link to="/cotacao-dolar">Financeiro → Cotação do dólar</Link>.
      </p>
    </section>
  )
}
