import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'

export const categoriasClienteRouter = Router()

categoriasClienteRouter.use(requireAuth)

categoriasClienteRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nome FROM categorias_cliente WHERE ativo = 1 ORDER BY nome ASC',
    )
    res.json({ categorias: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar categorias de cliente.' })
  }
})

categoriasClienteRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome ?? '').trim()
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    const [r] = await pool.query(
      'INSERT INTO categorias_cliente (nome) VALUES (?)',
      [nome],
    ) as any[]
    res.status(201).json({ categoria: { id: r.insertId, nome } })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Categoria já cadastrada.' })
    res.status(500).json({ erro: 'Erro ao salvar categoria.' })
  }
})

categoriasClienteRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE categorias_cliente SET ativo = 0 WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover categoria.' })
  }
})
