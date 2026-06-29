import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireAdmin } from '../auth/middleware.js'

export const oportunidadesRouter = Router()

oportunidadesRouter.use(requireAuth)

const STATUS_VALIDOS = ['prospeccao', 'proposta_enviada', 'negociacao', 'ganha', 'perdida', 'pos_venda'] as const

oportunidadesRouter.get('/', async (req, res) => {
  const { status, vendedorId, q } = req.query as Record<string, string>
  const condicoes: string[] = []
  const parametros: any[] = []

  if (status) {
    condicoes.push('o.status = ?')
    parametros.push(status)
  }
  if (vendedorId) {
    condicoes.push('o.vendedor_id = ?')
    parametros.push(Number(vendedorId))
  }
  if (q?.trim()) {
    condicoes.push('(o.titulo LIKE ? OR c.razao_social LIKE ? OR c.nome_fantasia LIKE ? OR l.nome_empresa LIKE ?)')
    const termo = `%${q.trim()}%`
    parametros.push(termo, termo, termo, termo)
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
  const [rows] = await pool.query(
    `SELECT o.*, u.nome AS vendedor_nome,
            COALESCE(c.razao_social, l.nome_empresa, l.contato) AS cliente_nome
       FROM oportunidades o
       LEFT JOIN usuarios u ON u.id = o.vendedor_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN leads l ON l.id = o.lead_id
       ${where}
       ORDER BY o.criado_em DESC`,
    parametros,
  )
  res.json({ oportunidades: rows })
})

oportunidadesRouter.get('/resumo', async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS total FROM oportunidades GROUP BY status`,
  )
  res.json({ resumo: rows })
})

oportunidadesRouter.get('/:id', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT o.*, u.nome AS vendedor_nome, c.razao_social AS cliente_nome,
            l.nome_empresa AS lead_nome_empresa, l.contato AS lead_contato
       FROM oportunidades o
       LEFT JOIN usuarios u ON u.id = o.vendedor_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN leads l ON l.id = o.lead_id
       WHERE o.id = ?`,
    [req.params.id],
  )
  const oportunidade = (rows as any[])[0]
  if (!oportunidade) return res.status(404).json({ erro: 'Oportunidade não encontrada.' })

  const [propostas] = await pool.query(
    `SELECT id, status, total, criado_em FROM propostas WHERE oportunidade_id = ? ORDER BY criado_em DESC`,
    [req.params.id],
  )
  res.json({ oportunidade: { ...oportunidade, propostas } })
})

oportunidadesRouter.post('/', async (req, res) => {
  const { cliente_id, lead_id, vendedor_id, titulo, valor_estimado } = req.body ?? {}

  if (!cliente_id && !lead_id) {
    return res.status(400).json({ erro: 'Informe um cliente ou um lead de origem.' })
  }
  if (cliente_id && lead_id) {
    return res.status(400).json({ erro: 'Informe apenas um: cliente ou lead, não os dois.' })
  }
  if (!titulo?.trim()) {
    return res.status(400).json({ erro: 'Título é obrigatório.' })
  }

  const [resultado] = await pool.query(
    `INSERT INTO oportunidades (lead_id, cliente_id, vendedor_id, titulo, valor_estimado)
     VALUES (?, ?, ?, ?, ?)`,
    [lead_id ?? null, cliente_id ?? null, vendedor_id ?? req.usuario!.id, titulo.trim(), valor_estimado || null],
  ) as any[]

  const [rows] = await pool.query('SELECT * FROM oportunidades WHERE id = ?', [resultado.insertId])
  res.status(201).json({ oportunidade: (rows as any[])[0] })
})

oportunidadesRouter.put('/:id', async (req, res) => {
  const { titulo, valor_estimado, vendedor_id } = req.body ?? {}
  const dados: Record<string, unknown> = {}
  if (titulo !== undefined) dados.titulo = titulo
  if (valor_estimado !== undefined) dados.valor_estimado = valor_estimado || null
  if (vendedor_id !== undefined) dados.vendedor_id = vendedor_id

  if (Object.keys(dados).length === 0) {
    return res.status(400).json({ erro: 'Nenhum dado para atualizar.' })
  }

  const [resultado] = await pool.query('UPDATE oportunidades SET ? WHERE id = ?', [dados, req.params.id]) as any[]
  if (resultado.affectedRows === 0) return res.status(404).json({ erro: 'Oportunidade não encontrada.' })

  const [rows] = await pool.query('SELECT * FROM oportunidades WHERE id = ?', [req.params.id])
  res.json({ oportunidade: (rows as any[])[0] })
})

oportunidadesRouter.post('/:id/pos-venda', async (req, res) => {
  const [resultado] = await pool.query(
    `UPDATE oportunidades SET status = 'pos_venda' WHERE id = ? AND status = 'ganha'`,
    [req.params.id],
  ) as any[]
  if (resultado.affectedRows === 0) {
    return res.status(409).json({ erro: 'Só é possível mover para pós-venda uma oportunidade ganha.' })
  }
  res.json({ ok: true })
})

oportunidadesRouter.post('/:id/perder', async (req, res) => {
  const { motivo } = req.body ?? {}
  const [resultado] = await pool.query(
    `UPDATE oportunidades SET status = 'perdida', motivo_perda = ?
     WHERE id = ? AND status NOT IN ('ganha', 'perdida', 'pos_venda')`,
    [motivo?.trim() || null, req.params.id],
  ) as any[]
  if (resultado.affectedRows === 0) {
    return res.status(409).json({ erro: 'Esta oportunidade não pode mais ser marcada como perdida.' })
  }
  res.json({ ok: true })
})

// Backfill administrativo: cria oportunidades para leads/propostas existentes que
// ainda não têm uma. Idempotente — pode ser rodado de novo sem duplicar.
oportunidadesRouter.post('/backfill', requireAdmin, async (_req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [leadsSemOportunidade] = await conn.query(
      `SELECT l.* FROM leads l
       WHERE NOT EXISTS (SELECT 1 FROM oportunidades o WHERE o.lead_id = l.id)
         AND l.vendedor_id IS NOT NULL`,
    ) as any[]

    let criadasDeLeads = 0
    for (const lead of leadsSemOportunidade) {
      const statusInicial = lead.status === 'descartado' ? 'perdida' : 'prospeccao'
      await conn.query(
        `INSERT INTO oportunidades (lead_id, vendedor_id, titulo, status)
         VALUES (?, ?, ?, ?)`,
        [lead.id, lead.vendedor_id, lead.nome_empresa || lead.contato || `Lead #${lead.id}`, statusInicial],
      )
      criadasDeLeads++
    }

    const [propostasSemOportunidade] = await conn.query(
      `SELECT p.*, c.razao_social FROM propostas p
       JOIN clientes c ON c.id = p.cliente_id
       WHERE p.oportunidade_id IS NULL`,
    ) as any[]

    let criadasDePropostas = 0
    let propostasVinculadas = 0
    for (const proposta of propostasSemOportunidade) {
      const [existente] = await conn.query(
        `SELECT o.id FROM oportunidades o
         WHERE o.cliente_id = ? AND o.criado_em <= ?
         ORDER BY o.criado_em DESC LIMIT 1`,
        [proposta.cliente_id, proposta.criado_em],
      ) as any[]

      let oportunidadeId = existente[0]?.id

      if (!oportunidadeId) {
        const statusInicial =
          proposta.status === 'convertida' ? 'ganha' :
          proposta.status === 'aprovada' ? 'negociacao' :
          proposta.status === 'recusada' ? 'perdida' : 'proposta_enviada'

        const [resultado] = await conn.query(
          `INSERT INTO oportunidades (cliente_id, vendedor_id, titulo, status, venda_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            proposta.cliente_id, proposta.vendedor_id,
            `${proposta.razao_social} — Proposta #${proposta.id}`,
            statusInicial,
            null,
          ],
        ) as any[]
        oportunidadeId = resultado.insertId
        criadasDePropostas++
      }

      await conn.query('UPDATE propostas SET oportunidade_id = ? WHERE id = ?', [oportunidadeId, proposta.id])
      propostasVinculadas++
    }

    await conn.commit()
    res.json({ ok: true, criadasDeLeads, criadasDePropostas, propostasVinculadas })
  } catch (err: any) {
    await conn.rollback()
    res.status(500).json({ erro: err.message ?? 'Erro ao executar backfill.' })
  } finally {
    conn.release()
  }
})
