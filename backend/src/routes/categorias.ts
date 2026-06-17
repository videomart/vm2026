import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'

export const categoriasRouter = Router()

categoriasRouter.use(requireAuth)

categoriasRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.nome,
             (SELECT COUNT(*) FROM produtos p WHERE p.categoria = c.nome) AS total_produtos
      FROM categorias c
      WHERE c.ativo = 1
      ORDER BY c.nome ASC
    `)
    res.json({ categorias: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar categorias.' })
  }
})

categoriasRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.nome, (SELECT COUNT(*) FROM produtos p WHERE p.categoria = c.nome) AS total
       FROM categorias c WHERE c.id = ?`,
      [req.params.id],
    ) as any[]
    if ((rows as any[])[0]?.total > 0) {
      return res.status(409).json({ erro: 'Esta categoria está vinculada a produtos e não pode ser removida.' })
    }
    await pool.query('UPDATE categorias SET ativo = 0 WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover categoria.' })
  }
})

categoriasRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome ?? '').trim()
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    const [r] = await pool.query(
      'INSERT INTO categorias (nome) VALUES (?)',
      [nome],
    ) as any[]
    res.status(201).json({ categoria: { id: r.insertId, nome } })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Categoria já cadastrada.' })
    res.status(500).json({ erro: 'Erro ao salvar categoria.' })
  }
})
