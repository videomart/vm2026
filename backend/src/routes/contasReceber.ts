import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const contasReceberRouter = Router()
contasReceberRouter.use(requireAuth)

async function recalcularStatus(contaId: number) {
  const [rows] = await pool.query(
    `SELECT cr.valor, cr.vencimento, cr.status,
            COALESCE((SELECT SUM(r.valor) FROM recebimentos r WHERE r.conta_id = cr.id), 0) AS total_recebido
     FROM contas_a_receber cr WHERE cr.id = ?`,
    [contaId],
  ) as any[]
  const conta = rows[0]
  if (!conta) return

  const valor = Number(conta.valor)
  const recebido = Number(conta.total_recebido)
  let novoStatus: string
  let pagoEm: string | null = null

  if (recebido >= valor) {
    novoStatus = 'pago'
    pagoEm = 'NOW()'
  } else if (recebido > 0) {
    novoStatus = 'parcial'
  } else {
    const vencida = new Date(conta.vencimento) < new Date(new Date().toISOString().slice(0, 10))
    novoStatus = vencida ? 'atrasado' : 'pendente'
  }

  if (pagoEm) {
    await pool.query(`UPDATE contas_a_receber SET status = ?, pago_em = NOW() WHERE id = ?`, [novoStatus, contaId])
  } else {
    await pool.query(`UPDATE contas_a_receber SET status = ?, pago_em = NULL WHERE id = ?`, [novoStatus, contaId])
  }
}

contasReceberRouter.get('/', async (req, res) => {
  try {
    const { status, q } = req.query as Record<string, string>

    // marca como atrasado quem está pendente/parcial e já passou do vencimento
    await pool.query(
      `UPDATE contas_a_receber SET status = 'atrasado' WHERE status IN ('pendente') AND vencimento < CURDATE()`,
    )

    const filtros: string[] = []
    const params: unknown[] = []

    if (status) { filtros.push('cr.status = ?'); params.push(status) }
    if (q?.trim()) {
      filtros.push('(c.razao_social LIKE ? OR c.nome_fantasia LIKE ?)')
      const termo = `%${q.trim()}%`
      params.push(termo, termo)
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''

    const [rows] = await pool.query(`
      SELECT cr.id, cr.descricao, cr.valor, cr.vencimento, cr.status, cr.pago_em, cr.criado_em,
             cr.origem_tipo, cr.numero_parcela, cr.total_parcelas,
             cr.venda_id, v.proposta_id,
             cr.assinatura_id, a.descricao AS assinatura_descricao,
             c.id AS cliente_id, c.razao_social AS cliente_nome,
             u.nome AS vendedor_nome,
             COALESCE((SELECT SUM(r.valor) FROM recebimentos r WHERE r.conta_id = cr.id), 0) AS total_recebido
      FROM contas_a_receber cr
      LEFT JOIN vendas v ON v.id = cr.venda_id
      LEFT JOIN assinaturas a ON a.id = cr.assinatura_id
      JOIN clientes c ON c.id = COALESCE(v.cliente_id, a.cliente_id)
      LEFT JOIN usuarios u ON u.id = v.vendedor_id
      ${where}
      ORDER BY cr.vencimento ASC
    `, params)

    res.json({ contas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar contas a receber.' })
  }
})

// ─── Assinaturas recorrentes (SaaS) ─────────────────────────────────────────────

contasReceberRouter.get('/assinaturas', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.id, a.cliente_id, c.razao_social AS cliente_nome, a.descricao, a.valor_mensal,
             a.dia_vencimento, a.status, a.data_inicio, a.data_fim, a.criado_em
      FROM assinaturas a
      JOIN clientes c ON c.id = a.cliente_id
      ORDER BY a.status ASC, c.razao_social ASC
    `)
    res.json({ assinaturas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar assinaturas.' })
  }
})

contasReceberRouter.post('/assinaturas', async (req, res) => {
  try {
    const { cliente_id, descricao, valor_mensal, dia_vencimento, data_inicio } = req.body
    if (!cliente_id || !descricao?.trim() || !valor_mensal || !data_inicio) {
      return res.status(400).json({ erro: 'cliente_id, descricao, valor_mensal e data_inicio são obrigatórios.' })
    }
    const [r] = await pool.query(
      `INSERT INTO assinaturas (cliente_id, descricao, valor_mensal, dia_vencimento, data_inicio)
       VALUES (?, ?, ?, ?, ?)`,
      [cliente_id, descricao.trim(), Number(valor_mensal), Number(dia_vencimento) || 10, data_inicio],
    ) as any[]
    res.status(201).json({ assinatura: { id: r.insertId } })
  } catch {
    res.status(500).json({ erro: 'Erro ao criar assinatura.' })
  }
})

contasReceberRouter.put('/assinaturas/:id/cancelar', async (req, res) => {
  try {
    await pool.query(
      `UPDATE assinaturas SET status = 'cancelada', data_fim = COALESCE(data_fim, CURDATE()) WHERE id = ?`,
      [req.params.id],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao cancelar assinatura.' })
  }
})

// Gera as contas do mês corrente para assinaturas ativas que ainda não têm conta no mês.
// Chamado ao carregar a tela de contas a receber (idempotente).
contasReceberRouter.post('/assinaturas/gerar-mes', async (_req, res) => {
  try {
    const [assinaturas] = await pool.query(`
      SELECT id, cliente_id, descricao, valor_mensal, dia_vencimento
      FROM assinaturas
      WHERE status = 'ativa'
        AND data_inicio <= CURDATE()
        AND (data_fim IS NULL OR data_fim >= CURDATE())
    `) as any[]

    let geradas = 0
    for (const a of assinaturas) {
      const [existeRows] = await pool.query(
        `SELECT id FROM contas_a_receber
         WHERE assinatura_id = ? AND YEAR(vencimento) = YEAR(CURDATE()) AND MONTH(vencimento) = MONTH(CURDATE())`,
        [a.id],
      ) as any[]
      if (existeRows.length) continue

      const dia = Math.min(a.dia_vencimento, 28)
      const vencimento = `${new Date().toISOString().slice(0, 7)}-${String(dia).padStart(2, '0')}`

      await pool.query(
        `INSERT INTO contas_a_receber (origem_tipo, assinatura_id, descricao, valor, vencimento)
         VALUES ('assinatura', ?, ?, ?, ?)`,
        [a.id, a.descricao, a.valor_mensal, vencimento],
      )
      geradas++
    }

    res.json({ ok: true, geradas })
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar contas do mês.' })
  }
})

// ─── Recebimentos (pagamento total ou parcial) ─────────────────────────────────

contasReceberRouter.get('/:id/recebimentos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, valor, data_pagamento, forma_pagamento, observacao, criado_em
       FROM recebimentos WHERE conta_id = ? ORDER BY data_pagamento DESC`,
      [req.params.id],
    )
    res.json({ recebimentos: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar recebimentos.' })
  }
})

contasReceberRouter.post('/:id/recebimentos', async (req, res) => {
  try {
    const { valor, data_pagamento, forma_pagamento, observacao } = req.body
    if (!valor || Number(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor válido.' })
    if (!data_pagamento) return res.status(400).json({ erro: 'Informe a data do pagamento.' })

    const [contaRows] = await pool.query('SELECT valor FROM contas_a_receber WHERE id = ?', [req.params.id]) as any[]
    if (!contaRows[0]) return res.status(404).json({ erro: 'Conta não encontrada.' })

    const [jaRecebidoRows] = await pool.query(
      'SELECT COALESCE(SUM(valor), 0) AS total FROM recebimentos WHERE conta_id = ?',
      [req.params.id],
    ) as any[]
    const saldoRestante = Number(contaRows[0].valor) - Number(jaRecebidoRows[0].total)
    if (Number(valor) > saldoRestante + 0.01) {
      return res.status(400).json({ erro: `Valor maior que o saldo restante (${saldoRestante.toFixed(2)}).` })
    }

    await pool.query(
      `INSERT INTO recebimentos (conta_id, valor, data_pagamento, forma_pagamento, observacao)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, Number(valor), data_pagamento, forma_pagamento?.trim() || null, observacao?.trim() || null],
    )
    await recalcularStatus(Number(req.params.id))

    res.status(201).json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao registrar recebimento.' })
  }
})

contasReceberRouter.delete('/:id/recebimentos/:recebimentoId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM recebimentos WHERE id = ? AND conta_id = ?',
      [req.params.recebimentoId, req.params.id],
    )
    await recalcularStatus(Number(req.params.id))
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover recebimento.' })
  }
})

// Atalho: marcar conta inteira como paga de uma vez (cria recebimento do saldo total)
contasReceberRouter.put('/:id/pagar', async (req, res) => {
  try {
    const [contaRows] = await pool.query('SELECT valor FROM contas_a_receber WHERE id = ?', [req.params.id]) as any[]
    if (!contaRows[0]) return res.status(404).json({ erro: 'Conta não encontrada.' })

    const [jaRecebidoRows] = await pool.query(
      'SELECT COALESCE(SUM(valor), 0) AS total FROM recebimentos WHERE conta_id = ?',
      [req.params.id],
    ) as any[]
    const saldoRestante = Number(contaRows[0].valor) - Number(jaRecebidoRows[0].total)

    if (saldoRestante > 0.01) {
      await pool.query(
        `INSERT INTO recebimentos (conta_id, valor, data_pagamento) VALUES (?, ?, CURDATE())`,
        [req.params.id, saldoRestante],
      )
    }
    await recalcularStatus(Number(req.params.id))
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao marcar conta como paga.' })
  }
})

contasReceberRouter.put('/:id/reabrir', async (req, res) => {
  try {
    await pool.query('DELETE FROM recebimentos WHERE conta_id = ?', [req.params.id])
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

