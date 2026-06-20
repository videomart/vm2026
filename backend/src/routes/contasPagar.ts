import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const contasPagarRouter = Router()
contasPagarRouter.use(requireAuth)

async function recalcularStatus(contaId: number) {
  const [rows] = await pool.query(
    `SELECT cp.valor, cp.vencimento, cp.status,
            COALESCE((SELECT SUM(p.valor) FROM pagamentos p WHERE p.conta_id = cp.id), 0) AS total_pago
     FROM contas_a_pagar cp WHERE cp.id = ?`,
    [contaId],
  ) as any[]
  const conta = rows[0]
  if (!conta) return

  const valor = Number(conta.valor)
  const pago = Number(conta.total_pago)
  let novoStatus: string
  let pagoEm: string | null = null

  if (pago >= valor) {
    novoStatus = 'pago'
    pagoEm = 'NOW()'
  } else if (pago > 0) {
    novoStatus = 'parcial'
  } else {
    const vencida = new Date(conta.vencimento) < new Date(new Date().toISOString().slice(0, 10))
    novoStatus = vencida ? 'atrasado' : 'pendente'
  }

  if (pagoEm) {
    await pool.query(`UPDATE contas_a_pagar SET status = ?, pago_em = NOW() WHERE id = ?`, [novoStatus, contaId])
  } else {
    await pool.query(`UPDATE contas_a_pagar SET status = ?, pago_em = NULL WHERE id = ?`, [novoStatus, contaId])
  }
}

contasPagarRouter.get('/', async (req, res) => {
  try {
    const { status, q } = req.query as Record<string, string>

    // marca como atrasado quem está pendente e já passou do vencimento
    await pool.query(
      `UPDATE contas_a_pagar SET status = 'atrasado' WHERE status = 'pendente' AND vencimento < CURDATE()`,
    )

    const filtros: string[] = []
    const params: unknown[] = []

    if (status) { filtros.push('cp.status = ?'); params.push(status) }
    if (q?.trim()) {
      filtros.push('(f.razao_social LIKE ? OR f.nome_fantasia LIKE ?)')
      const termo = `%${q.trim()}%`
      params.push(termo, termo)
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''

    const [rows] = await pool.query(`
      SELECT cp.id, cp.descricao, cp.valor, cp.vencimento, cp.status, cp.pago_em, cp.criado_em,
             cp.origem_tipo, cp.numero_parcela, cp.total_parcelas,
             cp.despesa_recorrente_id, dr.descricao AS despesa_recorrente_descricao,
             f.id AS fornecedor_id, f.razao_social AS fornecedor_nome,
             cd.id AS categoria_despesa_id, cd.nome AS categoria_despesa_nome,
             COALESCE((SELECT SUM(p.valor) FROM pagamentos p WHERE p.conta_id = cp.id), 0) AS total_pago
      FROM contas_a_pagar cp
      JOIN fornecedores f ON f.id = cp.fornecedor_id
      LEFT JOIN categorias_despesa cd ON cd.id = cp.categoria_despesa_id
      LEFT JOIN despesas_recorrentes dr ON dr.id = cp.despesa_recorrente_id
      ${where}
      ORDER BY cp.vencimento ASC
    `, params)

    res.json({ contas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar contas a pagar.' })
  }
})

// Lançamento avulso (com ou sem parcelamento)
contasPagarRouter.post('/', async (req, res) => {
  try {
    const { fornecedor_id, categoria_despesa_id, descricao, valor, vencimento, parcelas } = req.body
    if (!fornecedor_id) return res.status(400).json({ erro: 'Selecione o fornecedor.' })
    if (!valor || Number(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor válido.' })
    if (!vencimento) return res.status(400).json({ erro: 'Informe o vencimento da primeira parcela.' })

    const totalParcelas = Math.max(1, Number(parcelas) || 1)
    const valorParcela = Number((Number(valor) / totalParcelas).toFixed(2))

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const idsCriados: number[] = []
      for (let i = 0; i < totalParcelas; i++) {
        const dataVencimento = new Date(vencimento + 'T12:00:00')
        dataVencimento.setMonth(dataVencimento.getMonth() + i)
        const [r] = await conn.query(
          `INSERT INTO contas_a_pagar
             (fornecedor_id, categoria_despesa_id, origem_tipo, numero_parcela, total_parcelas, descricao, valor, vencimento)
           VALUES (?, ?, 'avulsa', ?, ?, ?, ?, ?)`,
          [
            Number(fornecedor_id), categoria_despesa_id ? Number(categoria_despesa_id) : null,
            i + 1, totalParcelas, descricao?.trim() || null, valorParcela,
            dataVencimento.toISOString().slice(0, 10),
          ],
        ) as any[]
        idsCriados.push(r.insertId)
      }
      await conn.commit()
      res.status(201).json({ ok: true, ids: idsCriados })
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  } catch {
    res.status(500).json({ erro: 'Erro ao lançar conta a pagar.' })
  }
})

contasPagarRouter.delete('/:id', async (req, res) => {
  try {
    const [resultado] = await pool.query('DELETE FROM contas_a_pagar WHERE id = ?', [req.params.id]) as any[]
    if (resultado.affectedRows === 0) return res.status(404).json({ erro: 'Conta não encontrada.' })
    res.status(204).end()
  } catch {
    res.status(500).json({ erro: 'Erro ao excluir conta a pagar.' })
  }
})

// ─── Despesas recorrentes ────────────────────────────────────────────────────

contasPagarRouter.get('/recorrentes', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT dr.id, dr.fornecedor_id, f.razao_social AS fornecedor_nome,
             dr.categoria_despesa_id, cd.nome AS categoria_despesa_nome,
             dr.descricao, dr.valor_mensal, dr.dia_vencimento, dr.status,
             dr.data_inicio, dr.data_fim, dr.criado_em
      FROM despesas_recorrentes dr
      JOIN fornecedores f ON f.id = dr.fornecedor_id
      LEFT JOIN categorias_despesa cd ON cd.id = dr.categoria_despesa_id
      ORDER BY dr.status ASC, f.razao_social ASC
    `)
    res.json({ recorrentes: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar despesas recorrentes.' })
  }
})

contasPagarRouter.post('/recorrentes', async (req, res) => {
  try {
    const { fornecedor_id, categoria_despesa_id, descricao, valor_mensal, dia_vencimento, data_inicio } = req.body
    if (!fornecedor_id || !descricao?.trim() || !valor_mensal || !data_inicio) {
      return res.status(400).json({ erro: 'fornecedor_id, descricao, valor_mensal e data_inicio são obrigatórios.' })
    }
    const [r] = await pool.query(
      `INSERT INTO despesas_recorrentes (fornecedor_id, categoria_despesa_id, descricao, valor_mensal, dia_vencimento, data_inicio)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(fornecedor_id), categoria_despesa_id ? Number(categoria_despesa_id) : null,
        descricao.trim(), Number(valor_mensal), Number(dia_vencimento) || 10, data_inicio,
      ],
    ) as any[]
    res.status(201).json({ recorrente: { id: r.insertId } })
  } catch {
    res.status(500).json({ erro: 'Erro ao criar despesa recorrente.' })
  }
})

contasPagarRouter.put('/recorrentes/:id/cancelar', async (req, res) => {
  try {
    await pool.query(
      `UPDATE despesas_recorrentes SET status = 'cancelada', data_fim = COALESCE(data_fim, CURDATE()) WHERE id = ?`,
      [req.params.id],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao cancelar despesa recorrente.' })
  }
})

// Gera as contas do mês corrente para despesas recorrentes ativas que ainda não
// têm conta no mês. Chamado ao carregar a tela de contas a pagar (idempotente).
contasPagarRouter.post('/recorrentes/gerar-mes', async (_req, res) => {
  try {
    const [recorrentes] = await pool.query(`
      SELECT id, fornecedor_id, categoria_despesa_id, descricao, valor_mensal, dia_vencimento
      FROM despesas_recorrentes
      WHERE status = 'ativa'
        AND data_inicio <= CURDATE()
        AND (data_fim IS NULL OR data_fim >= CURDATE())
    `) as any[]

    let geradas = 0
    for (const d of recorrentes) {
      const [existeRows] = await pool.query(
        `SELECT id FROM contas_a_pagar
         WHERE despesa_recorrente_id = ? AND YEAR(vencimento) = YEAR(CURDATE()) AND MONTH(vencimento) = MONTH(CURDATE())`,
        [d.id],
      ) as any[]
      if (existeRows.length) continue

      const dia = Math.min(d.dia_vencimento, 28)
      const vencimento = `${new Date().toISOString().slice(0, 7)}-${String(dia).padStart(2, '0')}`

      await pool.query(
        `INSERT INTO contas_a_pagar (fornecedor_id, categoria_despesa_id, origem_tipo, despesa_recorrente_id, descricao, valor, vencimento)
         VALUES (?, ?, 'recorrente', ?, ?, ?, ?)`,
        [d.fornecedor_id, d.categoria_despesa_id, d.id, d.descricao, d.valor_mensal, vencimento],
      )
      geradas++
    }

    res.json({ ok: true, geradas })
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar contas do mês.' })
  }
})

// ─── Pagamentos (pagamento total ou parcial) ────────────────────────────────

contasPagarRouter.get('/:id/pagamentos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, valor, data_pagamento, forma_pagamento, observacao, criado_em
       FROM pagamentos WHERE conta_id = ? ORDER BY data_pagamento DESC`,
      [req.params.id],
    )
    res.json({ pagamentos: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar pagamentos.' })
  }
})

contasPagarRouter.post('/:id/pagamentos', async (req, res) => {
  try {
    const { valor, data_pagamento, forma_pagamento, observacao } = req.body
    if (!valor || Number(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor válido.' })
    if (!data_pagamento) return res.status(400).json({ erro: 'Informe a data do pagamento.' })

    const [contaRows] = await pool.query('SELECT valor FROM contas_a_pagar WHERE id = ?', [req.params.id]) as any[]
    if (!contaRows[0]) return res.status(404).json({ erro: 'Conta não encontrada.' })

    const [jaPagoRows] = await pool.query(
      'SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE conta_id = ?',
      [req.params.id],
    ) as any[]
    const saldoRestante = Number(contaRows[0].valor) - Number(jaPagoRows[0].total)
    if (Number(valor) > saldoRestante + 0.01) {
      return res.status(400).json({ erro: `Valor maior que o saldo restante (${saldoRestante.toFixed(2)}).` })
    }

    await pool.query(
      `INSERT INTO pagamentos (conta_id, valor, data_pagamento, forma_pagamento, observacao)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, Number(valor), data_pagamento, forma_pagamento?.trim() || null, observacao?.trim() || null],
    )
    await recalcularStatus(Number(req.params.id))

    res.status(201).json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao registrar pagamento.' })
  }
})

contasPagarRouter.delete('/:id/pagamentos/:pagamentoId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM pagamentos WHERE id = ? AND conta_id = ?',
      [req.params.pagamentoId, req.params.id],
    )
    await recalcularStatus(Number(req.params.id))
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover pagamento.' })
  }
})

// Atalho: marcar conta inteira como paga de uma vez (cria pagamento do saldo total)
contasPagarRouter.put('/:id/pagar', async (req, res) => {
  try {
    const [contaRows] = await pool.query('SELECT valor FROM contas_a_pagar WHERE id = ?', [req.params.id]) as any[]
    if (!contaRows[0]) return res.status(404).json({ erro: 'Conta não encontrada.' })

    const [jaPagoRows] = await pool.query(
      'SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE conta_id = ?',
      [req.params.id],
    ) as any[]
    const saldoRestante = Number(contaRows[0].valor) - Number(jaPagoRows[0].total)

    if (saldoRestante > 0.01) {
      await pool.query(
        `INSERT INTO pagamentos (conta_id, valor, data_pagamento) VALUES (?, ?, CURDATE())`,
        [req.params.id, saldoRestante],
      )
    }
    await recalcularStatus(Number(req.params.id))
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao marcar conta como paga.' })
  }
})

contasPagarRouter.put('/:id/reabrir', async (req, res) => {
  try {
    await pool.query('DELETE FROM pagamentos WHERE conta_id = ?', [req.params.id])
    const [r] = await pool.query(
      `UPDATE contas_a_pagar SET status = 'pendente', pago_em = NULL WHERE id = ?`,
      [req.params.id],
    ) as any[]
    if (r.affectedRows === 0) return res.status(404).json({ erro: 'Conta não encontrada.' })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao reabrir conta.' })
  }
})
