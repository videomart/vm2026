import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth, requireAdmin } from '../auth/middleware.js'

export const contasFinanceirasRouter = Router()
contasFinanceirasRouter.use(requireAuth)

contasFinanceirasRouter.get('/', async (req, res) => {
  try {
    const somenteAtivas = req.query.ativas === '1'
    const [rows] = await pool.query(`
      SELECT cf.id, cf.nome, cf.tipo, cf.saldo_inicial, cf.ativo, cf.criado_em,
             (
               cf.saldo_inicial
               + COALESCE((SELECT SUM(r.valor) FROM recebimentos r WHERE r.conta_financeira_id = cf.id), 0)
               - COALESCE((SELECT SUM(p.valor) FROM pagamentos p WHERE p.conta_financeira_id = cf.id), 0)
             ) AS saldo_atual
      FROM contas_financeiras cf
      ${somenteAtivas ? 'WHERE cf.ativo = 1' : ''}
      ORDER BY cf.ativo DESC, cf.nome ASC
    `)
    res.json({ contas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar contas financeiras.' })
  }
})

contasFinanceirasRouter.post('/', requireAdmin, async (req, res) => {
  try {
    const { nome, tipo, saldo_inicial } = req.body
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    if (!['caixa', 'banco', 'cartao'].includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido.' })
    const [r] = await pool.query(
      'INSERT INTO contas_financeiras (nome, tipo, saldo_inicial) VALUES (?, ?, ?)',
      [nome.trim(), tipo, Number(saldo_inicial) || 0],
    ) as any[]
    res.status(201).json({ conta: { id: r.insertId } })
  } catch {
    res.status(500).json({ erro: 'Erro ao criar conta financeira.' })
  }
})

contasFinanceirasRouter.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nome, tipo, saldo_inicial, ativo } = req.body
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    if (!['caixa', 'banco', 'cartao'].includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido.' })
    await pool.query(
      'UPDATE contas_financeiras SET nome = ?, tipo = ?, saldo_inicial = ?, ativo = ? WHERE id = ?',
      [nome.trim(), tipo, Number(saldo_inicial) || 0, ativo ? 1 : 0, req.params.id],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao salvar conta financeira.' })
  }
})

contasFinanceirasRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [usoR] = await pool.query('SELECT COUNT(*) AS total FROM recebimentos WHERE conta_financeira_id = ?', [req.params.id]) as any[]
    const [usoP] = await pool.query('SELECT COUNT(*) AS total FROM pagamentos WHERE conta_financeira_id = ?', [req.params.id]) as any[]
    if (usoR[0].total > 0 || usoP[0].total > 0) {
      return res.status(409).json({ erro: 'Esta conta já tem movimentações e não pode ser removida. Você pode desativá-la.' })
    }
    const [resultado] = await pool.query('DELETE FROM contas_financeiras WHERE id = ?', [req.params.id]) as any[]
    if (resultado.affectedRows === 0) return res.status(404).json({ erro: 'Conta não encontrada.' })
    res.status(204).end()
  } catch {
    res.status(500).json({ erro: 'Erro ao remover conta financeira.' })
  }
})
