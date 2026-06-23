import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const leadsRouter = Router()

const STATUS_VALIDOS = ['novo', 'em_contato', 'convertido', 'descartado'] as const

const CAMPOS_CAPTURA = [
  'nome_empresa',
  'contato',
  'telefone',
  'email',
  'cidade',
  'uf',
  'assunto',
  'mensagem',
] as const

// Endpoint público (sem autenticação): formulário do site grava leads aqui.
leadsRouter.post('/captura', async (req, res) => {
  const body = req.body ?? {}
  const dados: Record<string, unknown> = {}
  for (const campo of CAMPOS_CAPTURA) {
    const valor = body[campo]
    dados[campo] = typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null
  }

  if (!dados.contato && !dados.nome_empresa) {
    return res.status(400).json({ erro: 'Informe ao menos o nome do contato ou da empresa.' })
  }
  if (!dados.email && !dados.telefone) {
    return res.status(400).json({ erro: 'Informe ao menos um e-mail ou telefone para contato.' })
  }

  dados.origem = 'site'
  dados.status = 'novo'
  dados.vendedor_id = null

  await pool.query('INSERT INTO leads SET ?', [dados])
  res.status(201).json({ mensagem: 'Recebido com sucesso.' })
})

// Endpoint público compatível com o formato do site institucional (salvadb.php):
// aceita GET (legado CF7: titulo/nome/empresa/telefone/email/informacoes) e POST
// (novo handler WP: vm_tipo/vm_contato/vm_empresa/vm_telefone/vm_email/vm_produto/
// vm_data_pref), nos dois casos como application/x-www-form-urlencoded.
function processarCapturaSite(req: import('express').Request, res: import('express').Response) {
  return async () => {
    const isGet = req.method === 'GET'
    const origem = isGet ? (req.query as Record<string, string>) : (req.body as Record<string, string>)

    let nomeEmpresa: string
    let contato: string
    let telefone: string
    let email: string
    let assunto: string
    let mensagem: string

    if (isGet) {
      // formato legado CF7
      assunto = origem.titulo?.trim() || 'contato'
      contato = origem.nome?.trim() || ''
      nomeEmpresa = origem.empresa?.trim() || ''
      telefone = origem.telefone?.trim() || ''
      email = origem.email?.trim() || ''
      mensagem = origem.informacoes?.trim() || ''
    } else {
      // formato novo (handler WP)
      assunto = origem.vm_tipo?.trim() || 'contato'
      contato = origem.vm_contato?.trim() || ''
      nomeEmpresa = origem.vm_empresa?.trim() || ''
      telefone = origem.vm_telefone?.trim() || ''
      email = origem.vm_email?.trim() || ''
      const produto = origem.vm_produto?.trim() || ''
      const dataPref = origem.vm_data_pref?.trim() || ''
      mensagem = [
        produto ? `Produto: ${produto}` : '',
        dataPref ? `Data preferida: ${dataPref}` : '',
      ].filter(Boolean).join(' | ')
    }

    if (!contato && !nomeEmpresa) {
      res.status(400).json({ ok: false, error: 'missing_contact_or_company' })
      return
    }
    if (!email && !telefone) {
      res.status(400).json({ ok: false, error: 'missing_email_or_phone' })
      return
    }

    await pool.query('INSERT INTO leads SET ?', [{
      nome_empresa: nomeEmpresa || null,
      contato: contato || null,
      telefone: telefone || null,
      email: email || null,
      cidade: null,
      uf: null,
      assunto: assunto || null,
      mensagem: mensagem || null,
      origem: 'site',
      status: 'novo',
      vendedor_id: null,
    }])

    if (isGet) {
      // mantém o comportamento de redirect que o CF7 legado espera
      res.redirect('https://avideomart.com.br/obrigado')
      return
    }
    res.status(201).json({ ok: true })
  }
}

leadsRouter.get('/captura-site', async (req, res) => {
  try {
    await processarCapturaSite(req, res)()
  } catch {
    res.status(500).json({ ok: false, error: 'insert_failed' })
  }
})

leadsRouter.post('/captura-site', async (req, res) => {
  try {
    await processarCapturaSite(req, res)()
  } catch {
    res.status(500).json({ ok: false, error: 'insert_failed' })
  }
})

leadsRouter.use(requireAuth)

const CAMPOS_TEXTO = [...CAMPOS_CAPTURA, 'origem'] as const

function dadosLead(body: any) {
  const dados: Record<string, unknown> = {}
  for (const campo of CAMPOS_TEXTO) {
    if (body[campo] !== undefined) {
      const valor = body[campo]
      dados[campo] = typeof valor === 'string' && valor.trim() === '' ? null : valor
    }
  }
  if (body.vendedor_id !== undefined) {
    dados.vendedor_id = body.vendedor_id === '' || body.vendedor_id === null ? null : Number(body.vendedor_id)
  }
  if (body.status !== undefined) {
    dados.status = body.status
  }
  return dados
}

leadsRouter.get('/', async (req, res) => {
  const { status, vendedorId, q } = req.query as Record<string, string>
  const condicoes: string[] = []
  const parametros: any[] = []

  if (status) {
    condicoes.push('l.status = ?')
    parametros.push(status)
  }
  if (vendedorId === 'sem') {
    condicoes.push('l.vendedor_id IS NULL')
  } else if (vendedorId) {
    condicoes.push('l.vendedor_id = ?')
    parametros.push(Number(vendedorId))
  }
  if (q?.trim()) {
    condicoes.push('(l.nome_empresa LIKE ? OR l.contato LIKE ? OR l.email LIKE ?)')
    const termo = `%${q.trim()}%`
    parametros.push(termo, termo, termo)
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
  const [rows] = await pool.query(
    `SELECT l.*, u.nome AS vendedor_nome
       FROM leads l
       LEFT JOIN usuarios u ON u.id = l.vendedor_id
       ${where}
       ORDER BY l.criado_em DESC`,
    parametros,
  )
  res.json({ leads: rows })
})

leadsRouter.get('/:id', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT l.*, u.nome AS vendedor_nome
       FROM leads l
       LEFT JOIN usuarios u ON u.id = l.vendedor_id
       WHERE l.id = ?`,
    [req.params.id],
  )
  const lead = (rows as any[])[0]
  if (!lead) return res.status(404).json({ erro: 'Lead não encontrado.' })
  res.json({ lead })
})

leadsRouter.post('/', async (req, res) => {
  const dados = dadosLead(req.body ?? {})

  if (!dados.contato && !dados.nome_empresa) {
    return res.status(400).json({ erro: 'Informe ao menos o nome do contato ou da empresa.' })
  }
  if (!dados.origem) dados.origem = 'manual'

  const [resultado] = await pool.query('INSERT INTO leads SET ?', [dados])
  const id = (resultado as any).insertId

  const [rows] = await pool.query('SELECT * FROM leads WHERE id = ?', [id])
  res.status(201).json({ lead: (rows as any[])[0] })
})

leadsRouter.put('/:id', async (req, res) => {
  const dados = dadosLead(req.body ?? {})

  if ('status' in dados && !STATUS_VALIDOS.includes(dados.status as any)) {
    return res.status(400).json({ erro: 'Status inválido.' })
  }
  if (Object.keys(dados).length === 0) {
    return res.status(400).json({ erro: 'Nenhum dado para atualizar.' })
  }

  const [resultado] = await pool.query('UPDATE leads SET ? WHERE id = ?', [dados, req.params.id])
  if ((resultado as any).affectedRows === 0) {
    return res.status(404).json({ erro: 'Lead não encontrado.' })
  }

  const [rows] = await pool.query('SELECT * FROM leads WHERE id = ?', [req.params.id])
  res.json({ lead: (rows as any[])[0] })
})

// Exclusão em massa — usada pela seleção via checkbox no grid de leads.
leadsRouter.delete('/', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : []
  if (!ids.length) return res.status(400).json({ erro: 'Nenhum lead selecionado.' })

  const [resultado] = await pool.query('DELETE FROM leads WHERE id IN (?)', [ids])
  res.json({ ok: true, removidos: (resultado as any).affectedRows })
})

leadsRouter.delete('/:id', async (req, res) => {
  const [resultado] = await pool.query('DELETE FROM leads WHERE id = ?', [req.params.id])
  if ((resultado as any).affectedRows === 0) {
    return res.status(404).json({ erro: 'Lead não encontrado.' })
  }
  res.status(204).end()
})

leadsRouter.post('/:id/assumir', async (req, res) => {
  const [resultado] = await pool.query(
    `UPDATE leads SET vendedor_id = ?, status = IF(status = 'novo', 'em_contato', status) WHERE id = ?`,
    [req.usuario!.id, req.params.id],
  )
  if ((resultado as any).affectedRows === 0) {
    return res.status(404).json({ erro: 'Lead não encontrado.' })
  }

  const [rows] = await pool.query(
    `SELECT l.*, u.nome AS vendedor_nome
       FROM leads l
       LEFT JOIN usuarios u ON u.id = l.vendedor_id
       WHERE l.id = ?`,
    [req.params.id],
  )
  res.json({ lead: (rows as any[])[0] })
})
