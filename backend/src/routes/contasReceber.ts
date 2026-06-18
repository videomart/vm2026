import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const contasReceberRouter = Router()
contasReceberRouter.use(requireAuth)

contasReceberRouter.get('/', async (req, res) => {
  try {
    const { status, q } = req.query as Record<string, string>

    const filtros: string[] = []
    const params: unknown[] = []

    // marca como atrasado quem está pendente e já passou do vencimento
    await pool.query(
      `UPDATE contas_a_receber SET status = 'atrasado' WHERE status = 'pendente' AND vencimento < CURDATE()`,
    )

    if (status) { filtros.push('cr.status = ?'); params.push(status) }
    if (q?.trim()) {
      filtros.push('(c.razao_social LIKE ? OR c.nome_fantasia LIKE ?)')
      const termo = `%${q.trim()}%`
      params.push(termo, termo)
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''

    const [rows] = await pool.query(`
      SELECT cr.id, cr.descricao, cr.valor, cr.vencimento, cr.status, cr.pago_em, cr.criado_em,
             v.id AS venda_id, v.proposta_id, v.data AS venda_data,
             c.id AS cliente_id, c.razao_social AS cliente_nome,
             u.nome AS vendedor_nome
      FROM contas_a_receber cr
      JOIN vendas v ON v.id = cr.venda_id
      JOIN clientes c ON c.id = v.cliente_id
      JOIN usuarios u ON u.id = v.vendedor_id
      ${where}
      ORDER BY cr.vencimento ASC
    `, params)

    res.json({ contas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar contas a receber.' })
  }
})

contasReceberRouter.put('/:id/pagar', async (req, res) => {
  try {
    const [r] = await pool.query(
      `UPDATE contas_a_receber SET status = 'pago', pago_em = NOW() WHERE id = ?`,
      [req.params.id],
    ) as any[]
    if (r.affectedRows === 0) return res.status(404).json({ erro: 'Conta não encontrada.' })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao marcar conta como paga.' })
  }
})

contasReceberRouter.put('/:id/reabrir', async (req, res) => {
  try {
    const [r] = await pool.query(
      `UPDATE contas_a_receber SET status = 'pendente', pago_em = NULL WHERE id = ?`,
      [req.params.id],
    ) as any[]
    if (r.affectedRows === 0) return res.status(404).json({ erro: 'Conta não encontrada.' })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao reabrir conta.' })
  }
})
