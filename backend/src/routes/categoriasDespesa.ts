import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'

export const categoriasDespesaRouter = Router()

categoriasDespesaRouter.use(requireAuth)

categoriasDespesaRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cd.id, cd.nome,
             (SELECT COUNT(*) FROM contas_a_pagar cp WHERE cp.categoria_despesa_id = cd.id) AS total_contas
      FROM categorias_despesa cd
      WHERE cd.ativo = 1
      ORDER BY cd.nome ASC
    `)
    res.json({ categorias: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar categorias de despesa.' })
  }
})

categoriasDespesaRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome ?? '').trim()
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    const [r] = await pool.query(
      'INSERT INTO categorias_despesa (nome) VALUES (?)',
      [nome],
    ) as any[]
    res.status(201).json({ categoria: { id: r.insertId, nome } })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Categoria já cadastrada.' })
    res.status(500).json({ erro: 'Erro ao salvar categoria.' })
  }
})

categoriasDespesaRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS total FROM contas_a_pagar WHERE categoria_despesa_id = ?',
      [req.params.id],
    ) as any[]
    if ((rows as any[])[0]?.total > 0) {
      return res.status(409).json({ erro: 'Esta categoria está vinculada a contas a pagar e não pode ser removida.' })
    }
    await pool.query('UPDATE categorias_despesa SET ativo = 0 WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover categoria.' })
  }
})
