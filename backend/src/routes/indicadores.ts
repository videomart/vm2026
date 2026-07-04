import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { enviarEmail } from '../email.js'

export const indicadoresRouter = Router()

function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function slugUnico(base: string): Promise<string> {
  let slug = base
  let tentativa = 1
  while (true) {
    const [rows] = await pool.query('SELECT id FROM indicadores WHERE slug = ?', [slug]) as any[]
    if (!(rows as any[]).length) return slug
    slug = `${base}-${++tentativa}`
  }
}

// Endpoint público: formulário /indicacao/ do site
indicadoresRouter.post('/cadastro', async (req, res) => {
  const { nome, email, empresa, telefone, cpf_cnpj, preferencia_recompensa } = req.body ?? {}

  if (!nome?.trim() || !email?.trim()) {
    return res.status(400).json({ erro: 'Nome e e-mail são obrigatórios.' })
  }

  const emailLimpo = String(email).trim().toLowerCase()
  const [existente] = await pool.query('SELECT id, slug FROM indicadores WHERE email = ?', [emailLimpo]) as any[]
  if ((existente as any[]).length) {
    const ind = (existente as any[])[0]
    return res.status(409).json({
      erro: 'E-mail já cadastrado.',
      slug: ind.slug,
      link: `https://avideomart.com.br/?ref=${ind.slug}`,
    })
  }

  const base = gerarSlug(String(nome).trim())
  const slug = await slugUnico(base)

  const preferencia = ['comissao', 'credito'].includes(preferencia_recompensa)
    ? preferencia_recompensa
    : 'comissao'

  await pool.query('INSERT INTO indicadores SET ?', [{
    nome: String(nome).trim(),
    email: emailLimpo,
    empresa: empresa?.trim() || null,
    telefone: telefone?.trim() || null,
    cpf_cnpj: cpf_cnpj?.trim() || null,
    slug,
    preferencia_recompensa: preferencia,
  }])

  const linkIndicacao = `https://avideomart.com.br/?ref=${slug}`
  const nomeLimpo = String(nome).trim()

  res.status(201).json({ ok: true, slug, link: linkIndicacao })

  // E-mails em background — falha de SMTP não deve bloquear nem derrubar o processo
  enviarEmail({
    to: emailLimpo,
    subject: '[Videomart] Bem-vindo ao Programa de Indicação Premiada',
    html: `
      <p>Olá, <strong>${nomeLimpo}</strong>!</p>
      <p>Você está cadastrado no Programa de Indicação Premiada da Videomart.</p>
      <p>Seu link de indicação é:</p>
      <p style="font-size:18px; font-weight:bold;">
        <a href="${linkIndicacao}">${linkIndicacao}</a>
      </p>
      <p>Compartilhe este link com colegas do setor. Cada vez que alguém se tornar
      cliente da Videomart através do seu link, você receberá uma recompensa.</p>
      <p>Preferência de recompensa registrada: <strong>${preferencia === 'comissao' ? 'Comissão sobre a venda' : 'Crédito em serviços Videomart'}</strong></p>
      <p>Em caso de dúvidas, responda este e-mail ou entre em contato pelo WhatsApp.</p>
      <br>
      <p>— Equipe Videomart</p>
    `,
  }).catch((e: any) => console.error('[indicador] e-mail ao indicador falhou:', e.message))

  enviarEmail({
    to: 'comercial@videomart.com.br',
    subject: `[Videomart] Novo indicador cadastrado — ${nomeLimpo}`,
    html: `
      <p><strong>Nome:</strong> ${nomeLimpo}</p>
      <p><strong>E-mail:</strong> ${emailLimpo}</p>
      <p><strong>Empresa:</strong> ${empresa?.trim() || '—'}</p>
      <p><strong>Telefone:</strong> ${telefone?.trim() || '—'}</p>
      <p><strong>CPF/CNPJ:</strong> ${cpf_cnpj?.trim() || '—'}</p>
      <p><strong>Slug/link:</strong> <a href="${linkIndicacao}">${linkIndicacao}</a></p>
      <p><strong>Preferência:</strong> ${preferencia === 'comissao' ? 'Comissão' : 'Crédito em serviços'}</p>
    `,
  }).catch((e: any) => console.error('[indicador] e-mail ao comercial falhou:', e.message))
})

// Endpoints autenticados (uso interno no CRM)
indicadoresRouter.use(requireAuth)

indicadoresRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT i.*,
      COUNT(l.id) AS total_leads,
      SUM(l.status = 'convertido') AS total_convertidos
    FROM indicadores i
    LEFT JOIN leads l ON l.indicador_slug = i.slug
    GROUP BY i.id
    ORDER BY i.criado_em DESC
  `) as any[]
  res.json({ indicadores: rows })
})

indicadoresRouter.get('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM indicadores WHERE id = ?', [req.params.id]) as any[]
  const ind = (rows as any[])[0]
  if (!ind) return res.status(404).json({ erro: 'Indicador não encontrado.' })

  const [leads] = await pool.query(
    'SELECT id, contato, nome_empresa, email, status, criado_em FROM leads WHERE indicador_slug = ? ORDER BY criado_em DESC',
    [ind.slug],
  ) as any[]

  res.json({ indicador: ind, leads })
})

indicadoresRouter.patch('/:id/ativo', async (req, res) => {
  const ativo = req.body?.ativo ? 1 : 0
  await pool.query('UPDATE indicadores SET ativo = ? WHERE id = ?', [ativo, req.params.id])
  res.json({ ok: true })
})
