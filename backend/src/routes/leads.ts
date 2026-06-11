import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const leadsRouter = Router()

leadsRouter.use(requireAuth)

const STATUS_VALIDOS = ['novo', 'em_contato', 'convertido', 'descartado'] as const

const CAMPOS_TEXTO = [
  'nome_empresa',
  'contato',
  'telefone',
  'email',
  'cidade',
  'uf',
  'assunto',
  'mensagem',
  'origem',
] as const

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
