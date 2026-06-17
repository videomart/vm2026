import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'
import { enviarCampanha } from '../email.js'

export const campanhasRouter = Router()
campanhasRouter.use(requireAuth)

// ─── Grupos de envio ──────────────────────────────────────────────────────────

campanhasRouter.get('/grupos', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT g.id, g.nome, g.descricao, g.criado_em,
             COUNT(gc.cliente_id) AS total_clientes
      FROM grupos_envio g
      LEFT JOIN grupo_clientes gc ON gc.grupo_id = g.id
      GROUP BY g.id
      ORDER BY g.nome ASC
    `)
    res.json({ grupos: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar grupos.' })
  }
})

campanhasRouter.get('/grupos/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM grupos_envio WHERE id = ?', [req.params.id])
    const grupo = (rows as any[])[0]
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' })

    const [clientes] = await pool.query(`
      SELECT c.id, c.razao_social AS nome, c.email
      FROM grupo_clientes gc
      JOIN clientes c ON c.id = gc.cliente_id
      WHERE gc.grupo_id = ?
      ORDER BY c.razao_social ASC
    `, [req.params.id])

    res.json({ grupo, clientes })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar grupo.' })
  }
})

campanhasRouter.post('/grupos', requireAdmin, async (req, res) => {
  try {
    const { nome, descricao } = req.body
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    const [r] = await pool.query(
      'INSERT INTO grupos_envio (nome, descricao) VALUES (?, ?)',
      [nome.trim(), descricao?.trim() ?? null],
    ) as any[]
    res.status(201).json({ grupo: { id: r.insertId, nome: nome.trim(), descricao: descricao?.trim() ?? null } })
  } catch {
    res.status(500).json({ erro: 'Erro ao criar grupo.' })
  }
})

campanhasRouter.put('/grupos/:id', requireAdmin, async (req, res) => {
  try {
    const { nome, descricao } = req.body
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    await pool.query(
      'UPDATE grupos_envio SET nome = ?, descricao = ? WHERE id = ?',
      [nome.trim(), descricao?.trim() ?? null, req.params.id],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar grupo.' })
  }
})

campanhasRouter.delete('/grupos/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM grupos_envio WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover grupo.' })
  }
})

// Clientes do grupo
campanhasRouter.post('/grupos/:id/clientes', requireAdmin, async (req, res) => {
  try {
    const { cliente_ids } = req.body as { cliente_ids: number[] }
    if (!Array.isArray(cliente_ids) || !cliente_ids.length)
      return res.status(400).json({ erro: 'Informe ao menos um cliente.' })
    const values = cliente_ids.map((cid) => [Number(req.params.id), cid])
    await pool.query(
      'INSERT IGNORE INTO grupo_clientes (grupo_id, cliente_id) VALUES ?',
      [values],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao adicionar clientes.' })
  }
})

campanhasRouter.delete('/grupos/:id/clientes/:cliente_id', requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM grupo_clientes WHERE grupo_id = ? AND cliente_id = ?',
      [req.params.id, req.params.cliente_id],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover cliente do grupo.' })
  }
})

// ─── Campanhas / Disparos ─────────────────────────────────────────────────────

campanhasRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.assunto, c.enviado_em, c.criado_em,
             g.nome AS grupo_nome,
             u.nome AS enviado_por_nome
      FROM campanhas_email c
      JOIN grupos_envio g ON g.id = c.grupo_id
      JOIN usuarios u ON u.id = c.enviado_por
      ORDER BY c.criado_em DESC
      LIMIT 100
    `)
    res.json({ campanhas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar campanhas.' })
  }
})

campanhasRouter.post('/', requireAdmin, async (req: any, res) => {
  try {
    const { grupo_id, assunto, corpo } = req.body
    if (!grupo_id || !assunto?.trim() || !corpo?.trim())
      return res.status(400).json({ erro: 'grupo_id, assunto e corpo são obrigatórios.' })

    // Busca clientes do grupo que têm e-mail
    const [clientes] = await pool.query(`
      SELECT c.id, c.razao_social AS nome, c.email
      FROM grupo_clientes gc
      JOIN clientes c ON c.id = gc.cliente_id
      WHERE gc.grupo_id = ? AND c.email IS NOT NULL AND c.email != '' AND c.ativo = 1
    `, [grupo_id]) as any[][]

    if (!clientes.length)
      return res.status(400).json({ erro: 'Nenhum cliente com e-mail neste grupo.' })

    // Registra campanha
    const [r] = await pool.query(
      'INSERT INTO campanhas_email (grupo_id, assunto, corpo, enviado_por) VALUES (?, ?, ?, ?)',
      [grupo_id, assunto.trim(), corpo.trim(), req.usuario.id],
    ) as any[]
    const campanhaId = r.insertId

    // Dispara e-mails respeitando limite/hora configurado no setup
    const { enviados, erros } = await enviarCampanha(
      clientes.map((c: any) => ({ email: c.email, nome: c.nome })),
      assunto.trim(),
      corpo.trim(),
    )

    // Marca como enviado
    await pool.query(
      'UPDATE campanhas_email SET enviado_em = NOW() WHERE id = ?',
      [campanhaId],
    )

    res.json({
      ok: true,
      campanhaId,
      total: enviados,
      erros: erros.length ? erros : undefined,
    })
  } catch {
    res.status(500).json({ erro: 'Erro ao disparar campanha.' })
  }
})
