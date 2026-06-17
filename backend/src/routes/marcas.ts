import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'

export const marcasRouter = Router()

marcasRouter.use(requireAuth)

marcasRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.id, m.nome,
             (SELECT COUNT(*) FROM produtos p WHERE p.marca = m.nome) AS total_produtos
      FROM marcas m
      WHERE m.ativo = 1
      ORDER BY m.nome ASC
    `)
    res.json({ marcas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar marcas.' })
  }
})

marcasRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.nome, (SELECT COUNT(*) FROM produtos p WHERE p.marca = m.nome) AS total
       FROM marcas m WHERE m.id = ?`,
      [req.params.id],
    ) as any[]
    if ((rows as any[])[0]?.total > 0) {
      return res.status(409).json({ erro: 'Esta marca está vinculada a produtos e não pode ser removida.' })
    }
    await pool.query('UPDATE marcas SET ativo = 0 WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover marca.' })
  }
})

marcasRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome ?? '').trim()
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    const [r] = await pool.query(
      'INSERT INTO marcas (nome) VALUES (?)',
      [nome],
    ) as any[]
    res.status(201).json({ marca: { id: r.insertId, nome } })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Marca já cadastrada.' })
    res.status(500).json({ erro: 'Erro ao salvar marca.' })
  }
})
