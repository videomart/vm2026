import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireAdmin } from '../auth/middleware.js'

export const composicoesHardwareRouter = Router()

composicoesHardwareRouter.use(requireAuth)

composicoesHardwareRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM composicoes_hardware WHERE ativo = 1 ORDER BY nome ASC',
    )
    res.json({ composicoes: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar composições de hardware.' })
  }
})

composicoesHardwareRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome ?? '').trim()
    const itens = String(req.body.itens ?? '').trim()
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    if (!itens) return res.status(400).json({ erro: 'Itens são obrigatórios.' })
    const [r] = await pool.query(
      'INSERT INTO composicoes_hardware (nome, itens) VALUES (?, ?)',
      [nome, itens],
    ) as any[]
    res.status(201).json({ composicao: { id: r.insertId, nome, itens } })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma composição com esse nome.' })
    res.status(500).json({ erro: 'Erro ao salvar composição.' })
  }
})

composicoesHardwareRouter.put('/:id', requireAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome ?? '').trim()
    const itens = String(req.body.itens ?? '').trim()
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    if (!itens) return res.status(400).json({ erro: 'Itens são obrigatórios.' })
    const [result] = await pool.query(
      'UPDATE composicoes_hardware SET nome = ?, itens = ? WHERE id = ?',
      [nome, itens, req.params.id],
    ) as any[]
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Composição não encontrada.' })
    res.json({ ok: true })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma composição com esse nome.' })
    res.status(500).json({ erro: 'Erro ao atualizar composição.' })
  }
})

composicoesHardwareRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE composicoes_hardware SET ativo = 0 WHERE id = ? AND ativo = 1',
      [req.params.id],
    ) as any[]
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Composição não encontrada ou já inativa.' })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover composição.' })
  }
})
