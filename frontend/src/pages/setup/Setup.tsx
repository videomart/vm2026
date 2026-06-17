import { useEffect, useState } from 'react'

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
  smtp_host: string
  smtp_port: string
  smtp_secure: boolean
  smtp_user: string
  smtp_pass: string
  smtp_from: string
  smtp_limite_hora: string
}

type Cotacao = { id: number; data: string; valor: string; fonte: string | null } | null

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
  smtp_host: '',
  smtp_port: '465',
  smtp_secure: true,
  smtp_user: '',
  smtp_pass: '',
  smtp_from: '',
  smtp_limite_hora: '100',
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
    smtp_host: s.smtp_host ?? '',
    smtp_port: String(s.smtp_port ?? '465'),
    smtp_secure: Boolean(s.smtp_secure ?? true),
    smtp_user: s.smtp_user ?? '',
    smtp_pass: s.smtp_pass ?? '',
    smtp_from: s.smtp_from ?? '',
    smtp_limite_hora: String(s.smtp_limite_hora ?? '100'),
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
  const [cotacao, setCotacao] = useState<Cotacao>(null)
  const [novaCotacaoData, setNovaCotacaoData] = useState(new Date().toISOString().slice(0, 10))
  const [novaCotacaoValor, setNovaCotacaoValor] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [salvandoLogo, setSalvandoLogo] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/setup', { credentials: 'include' }),
      fetch('/api/setup/cotacao', { credentials: 'include' }),
      fetch('/api/setup/logo', { credentials: 'include' }),
    ])
      .then(async ([rs, rco, rlo]) => {
        const [ds, dco] = await Promise.all([rs.json(), rco.json()])
        if (ds.setup) setCampos(paraForm(ds.setup))
        setCotacao(dco.cotacao ?? null)
        if (rlo.ok) {
          const blob = await rlo.blob()
          setLogoPreview(URL.createObjectURL(blob))
        }
      })
      .catch(() => setErro('Erro ao carregar configurações.'))
      .finally(() => setCarregando(false))
  }, [])

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setLogoPreview(base64)
      setSalvandoLogo(true)
      try {
        await fetch('/api/setup/logo', {
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

  async function removerLogo() {
    setSalvandoLogo(true)
    try {
      await fetch('/api/setup/logo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logo_base64: null }),
      })
      setLogoPreview(null)
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
          smtp_port: Number(campos.smtp_port),
          smtp_secure: campos.smtp_secure,
          smtp_limite_hora: Number(campos.smtp_limite_hora),
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

  async function salvarCotacao(e: React.FormEvent) {
    e.preventDefault()
    if (!novaCotacaoValor) return
    const res = await fetch('/api/setup/cotacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ data: novaCotacaoData, valor: novaCotacaoValor, fonte: 'manual' }),
    })
    const d = await res.json()
    if (res.ok) {
      setCotacao(d.cotacao)
      setMsg('Cotação salva.')
    } else {
      setErro(d.erro ?? 'Erro ao salvar cotação.')
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

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" style={{ maxHeight: '64px', maxWidth: '200px', objectFit: 'contain', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px', background: '#fff' }} />
          ) : (
            <div style={{ width: '200px', height: '64px', border: '1px dashed var(--border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text)' }}>
              Sem logo
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="botao-secundario" style={{ cursor: 'pointer', display: 'inline-block' }}>
              {salvandoLogo ? 'Salvando...' : 'Alterar logo'}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={onLogoChange} disabled={salvandoLogo} />
            </label>
            {logoPreview && (
              <button type="button" className="botao-perigo" onClick={removerLogo} disabled={salvandoLogo} style={{ fontSize: '12px', padding: '4px 10px' }}>
                Remover
              </button>
            )}
            <span style={{ fontSize: '11px', color: 'var(--text)' }}>PNG, JPG ou SVG. Recomendado: até 400×100px.</span>
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
        <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
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
        <div className="grade-formulario" style={{ gridTemplateColumns: '2fr 90px 110px 1fr' }}>
          <div className="campo">
            <label>Servidor SMTP</label>
            <input
              className="sem-uppercase"
              value={campos.smtp_host}
              onChange={(e) => atualizar('smtp_host', e.target.value)}
              placeholder="smtp.hostinger.com"
            />
          </div>
          <div className="campo">
            <label>Porta</label>
            <input type="number" min="1" max="65535" value={campos.smtp_port} onChange={(e) => atualizar('smtp_port', e.target.value)} />
          </div>
          <div className="campo">
            <label>SSL/TLS</label>
            <select value={campos.smtp_secure ? '1' : '0'} onChange={(e) => setCampos((c) => ({ ...c, smtp_secure: e.target.value === '1' }))}>
              <option value="1">Sim (465)</option>
              <option value="0">Não (587)</option>
            </select>
          </div>
          <div className="campo">
            <label>Limite de envios/hora</label>
            <input type="number" min="1" max="10000" value={campos.smtp_limite_hora} onChange={(e) => atualizar('smtp_limite_hora', e.target.value)} />
          </div>
        </div>
        <div className="grade-formulario" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="campo">
            <label>Usuário / E-mail remetente</label>
            <input
              className="sem-uppercase"
              value={campos.smtp_user}
              onChange={(e) => atualizar('smtp_user', e.target.value)}
              placeholder="envios@suaempresa.com.br"
            />
          </div>
          <div className="campo">
            <label>Senha</label>
            <input
              type="password"
              value={campos.smtp_pass}
              onChange={(e) => atualizar('smtp_pass', e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="grade-formulario">
          <div className="campo campo-largo">
            <label>Nome e endereço de exibição (From)</label>
            <input
              className="sem-uppercase"
              value={campos.smtp_from}
              onChange={(e) => atualizar('smtp_from', e.target.value)}
              placeholder='Videomart Broadcast <envios@suaempresa.com.br>'
            />
            <span style={{ fontSize: '12px', color: 'var(--text)' }}>
              Deve usar o mesmo domínio do usuário SMTP para evitar rejeição pelo servidor. Campanhas respeitam o limite de envios/hora configurado acima.
            </span>
          </div>
        </div>

        <div className="barra-acoes-formulario">
          <button className="botao" type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </form>

      {/* ── Cotação do dólar ── */}
      <h3 style={H3}>Cotação do dólar</h3>
      {cotacao ? (
        <p style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text)' }}>
          Última cotação:{' '}
          <strong style={{ color: 'var(--text-h)' }}>
            R$ {Number(cotacao.valor).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}
          </strong>{' '}
          em {cotacao.data?.slice(0, 10).split('-').reverse().join('/')}
          {cotacao.fonte && ` (${cotacao.fonte})`}
        </p>
      ) : (
        <p style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text)' }}>Nenhuma cotação cadastrada ainda.</p>
      )}
      <form onSubmit={salvarCotacao} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="campo" style={{ margin: 0 }}>
          <label>Data</label>
          <input type="date" value={novaCotacaoData} onChange={(e) => setNovaCotacaoData(e.target.value)} required />
        </div>
        <div className="campo" style={{ margin: 0 }}>
          <label>Valor (R$)</label>
          <input type="number" min="0.01" step="0.0001" placeholder="5.7500" value={novaCotacaoValor} onChange={(e) => setNovaCotacaoValor(e.target.value)} required />
        </div>
        <button className="botao" type="submit">Salvar cotação</button>
      </form>
    </section>
  )
}
