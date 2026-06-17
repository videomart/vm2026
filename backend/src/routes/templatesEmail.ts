import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'

export const templatesEmailRouter = Router()
templatesEmailRouter.use(requireAuth)

templatesEmailRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nome, assunto, corpo_html FROM templates_email WHERE ativo = 1 ORDER BY nome ASC',
    )
    res.json({ templates: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar templates.' })
  }
})

templatesEmailRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const { nome, assunto, corpo_html } = req.body
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    const [r] = await pool.query(
      'INSERT INTO templates_email (nome, assunto, corpo_html) VALUES (?, ?, ?)',
      [nome.trim(), assunto?.trim() ?? null, corpo_html ?? null],
    ) as any[]
    res.status(201).json({ template: { id: r.insertId, nome: nome.trim(), assunto: assunto?.trim() ?? null, corpo_html: corpo_html ?? null } })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Template já cadastrado.' })
    res.status(500).json({ erro: 'Erro ao salvar template.' })
  }
})

templatesEmailRouter.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nome, assunto, corpo_html } = req.body
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    await pool.query(
      'UPDATE templates_email SET nome = ?, assunto = ?, corpo_html = ? WHERE id = ?',
      [nome.trim(), assunto?.trim() ?? null, corpo_html ?? null, req.params.id],
    )
    res.json({ ok: true })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Template já cadastrado.' })
    res.status(500).json({ erro: 'Erro ao salvar template.' })
  }
})

templatesEmailRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE templates_email SET ativo = 0 WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover template.' })
  }
})
