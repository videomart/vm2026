import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const contasPagarRouter = Router()
contasPagarRouter.use(requireAuth)

const PERIODOS = ['semana', 'mes', 'ano'] as const
type Periodo = (typeof PERIODOS)[number]

const INICIO_PERIODO: Record<Periodo, string> = {
  semana: 'DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)',
  mes: "DATE_FORMAT(CURDATE(), '%Y-%m-01')",
  ano: "DATE_FORMAT(CURDATE(), '%Y-01-01')",
}

const FIM_PERIODO: Record<Periodo, string> = {
  semana: 'DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)',
  mes: "LAST_DAY(CURDATE())",
  ano: "DATE_FORMAT(CURDATE(), '%Y-12-31')",
}

// Pagamentos podem estar em moeda diferente da conta — converte pela cotação
// informada no momento do pagamento antes de somar ao total pago.
const SQL_VALOR_PAGO_CONVERTIDO = `
  COALESCE((
    SELECT SUM(IF(p.moeda = cp.moeda, p.valor, p.valor / p.cotacao))
    FROM pagamentos p WHERE p.conta_id = cp.id
  ), 0)
`

// ─── Relatório (resumo por status + lista detalhada no período) ────────────────

contasPagarRouter.get('/relatorio', async (req, res) => {
  try {
    const periodoParam = req.query.periodo as string | undefined
    const periodo: Periodo = (PERIODOS as readonly string[]).includes(periodoParam ?? '')
      ? (periodoParam as Periodo)
      : 'mes'
    const inicio = INICIO_PERIODO[periodo]
    const fim = FIM_PERIODO[periodo]

    await pool.query(
      `UPDATE contas_a_pagar SET status = 'atrasado' WHERE status = 'pendente' AND vencimento < CURDATE()`,
    )

    const [porStatus] = await pool.query(`
      SELECT cp.status, COUNT(*) AS total, COALESCE(SUM(cp.valor), 0) AS valor_total,
             COALESCE(SUM(${SQL_VALOR_PAGO_CONVERTIDO}), 0) AS valor_pago
      FROM contas_a_pagar cp
      WHERE cp.vencimento BETWEEN ${inicio} AND ${fim}
      GROUP BY cp.status
    `) as any[]

    const resumo: Record<string, { total: number; valor_total: number; valor_pago: number }> = {
      pendente: { total: 0, valor_total: 0, valor_pago: 0 },
      parcial: { total: 0, valor_total: 0, valor_pago: 0 },
      pago: { total: 0, valor_total: 0, valor_pago: 0 },
      atrasado: { total: 0, valor_total: 0, valor_pago: 0 },
    }
    for (const row of porStatus as any[]) {
      resumo[row.status] = {
        total: Number(row.total),
        valor_total: Number(row.valor_total),
        valor_pago: Number(row.valor_pago),
      }
    }

    const [contas] = await pool.query(`
      SELECT cp.id, cp.descricao, cp.valor, cp.vencimento, cp.status, cp.pago_em,
             cp.origem_tipo, cp.numero_parcela, cp.total_parcelas,
             f.razao_social AS fornecedor_nome,
             cd.nome AS categoria_despesa_nome,
             ${SQL_VALOR_PAGO_CONVERTIDO} AS total_pago
      FROM contas_a_pagar cp
      JOIN fornecedores f ON f.id = cp.fornecedor_id
      LEFT JOIN categorias_despesa cd ON cd.id = cp.categoria_despesa_id
      WHERE cp.vencimento BETWEEN ${inicio} AND ${fim}
      ORDER BY cp.vencimento ASC
    `)

    res.json({ periodo, resumo, contas })
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar relatório de contas a pagar.' })
  }
})

async function recalcularStatus(contaId: number) {
  const [rows] = await pool.query(
    `SELECT cp.valor, cp.vencimento, cp.status,
            ${SQL_VALOR_PAGO_CONVERTIDO} AS total_pago
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
      SELECT cp.id, cp.descricao, cp.valor, cp.moeda, cp.vencimento, cp.status, cp.pago_em, cp.criado_em,
             cp.origem_tipo, cp.numero_parcela, cp.total_parcelas,
             cp.despesa_recorrente_id, dr.descricao AS despesa_recorrente_descricao,
             f.id AS fornecedor_id, f.razao_social AS fornecedor_nome,
             cd.id AS categoria_despesa_id, cd.nome AS categoria_despesa_nome,
             ${SQL_VALOR_PAGO_CONVERTIDO} AS total_pago
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
    const { fornecedor_id, categoria_despesa_id, descricao, valor, moeda, vencimento, parcelas } = req.body
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
             (fornecedor_id, categoria_despesa_id, origem_tipo, numero_parcela, total_parcelas, descricao, valor, moeda, vencimento)
           VALUES (?, ?, 'avulsa', ?, ?, ?, ?, ?, ?)`,
          [
            Number(fornecedor_id), categoria_despesa_id ? Number(categoria_despesa_id) : null,
            i + 1, totalParcelas, descricao?.trim() || null, valorParcela,
            (moeda || 'BRL').toUpperCase(), dataVencimento.toISOString().slice(0, 10),
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

// Edição: só permitida se a conta ainda não tiver nenhum pagamento (senão os
// valores já baixados ficariam dissociados do valor/vencimento exibido).
contasPagarRouter.put('/:id', async (req, res) => {
  try {
    const [contaRows] = await pool.query(
      `SELECT ${SQL_VALOR_PAGO_CONVERTIDO} AS total_pago FROM contas_a_pagar cp WHERE cp.id = ?`,
      [req.params.id],
    ) as any[]
    const conta = contaRows[0]
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada.' })
    if (Number(conta.total_pago) > 0) {
      return res.status(409).json({ erro: 'Esta conta já possui pagamentos e não pode ser editada. Reabra-a primeiro.' })
    }

    const { fornecedor_id, categoria_despesa_id, descricao, valor, moeda, vencimento } = req.body
    if (!fornecedor_id) return res.status(400).json({ erro: 'Selecione o fornecedor.' })
    if (!valor || Number(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor válido.' })
    if (!vencimento) return res.status(400).json({ erro: 'Informe o vencimento.' })

    await pool.query(
      `UPDATE contas_a_pagar
       SET fornecedor_id = ?, categoria_despesa_id = ?, descricao = ?, valor = ?, moeda = ?, vencimento = ?
       WHERE id = ?`,
      [
        Number(fornecedor_id), categoria_despesa_id ? Number(categoria_despesa_id) : null,
        descricao?.trim() || null, Number(valor), (moeda || 'BRL').toUpperCase(), vencimento, req.params.id,
      ],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao salvar conta a pagar.' })
  }
})

// Exclusão: só permitida se a conta ainda não tiver pagamento algum (nem parcial).
contasPagarRouter.delete('/:id', async (req, res) => {
  try {
    const [contaRows] = await pool.query(
      `SELECT ${SQL_VALOR_PAGO_CONVERTIDO} AS total_pago FROM contas_a_pagar cp WHERE cp.id = ?`,
      [req.params.id],
    ) as any[]
    if (!contaRows[0]) return res.status(404).json({ erro: 'Conta não encontrada.' })
    if (Number(contaRows[0].total_pago) > 0) {
      return res.status(409).json({ erro: 'Esta conta já possui pagamentos e não pode ser excluída. Reabra-a primeiro.' })
    }

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
      `SELECT p.id, p.valor, p.moeda, p.cotacao, p.data_pagamento, p.forma_pagamento, p.observacao, p.criado_em,
              p.conta_financeira_id, cf.nome AS conta_financeira_nome
       FROM pagamentos p
       LEFT JOIN contas_financeiras cf ON cf.id = p.conta_financeira_id
       WHERE p.conta_id = ? ORDER BY p.data_pagamento DESC`,
      [req.params.id],
    )
    res.json({ pagamentos: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar pagamentos.' })
  }
})

contasPagarRouter.post('/:id/pagamentos', async (req, res) => {
  try {
    const { valor, moeda, cotacao, data_pagamento, forma_pagamento, conta_financeira_id, observacao } = req.body
    if (!valor || Number(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor válido.' })
    if (!data_pagamento) return res.status(400).json({ erro: 'Informe a data do pagamento.' })

    const [contaRows] = await pool.query('SELECT valor, moeda FROM contas_a_pagar WHERE id = ?', [req.params.id]) as any[]
    if (!contaRows[0]) return res.status(404).json({ erro: 'Conta não encontrada.' })

    const moedaConta = contaRows[0].moeda
    const moedaPagamento = (moeda || moedaConta).toUpperCase()
    if (moedaPagamento !== moedaConta && !(Number(cotacao) > 0)) {
      return res.status(400).json({ erro: `Informe a cotação para converter de ${moedaPagamento} para ${moedaConta}.` })
    }
    const valorConvertido = moedaPagamento === moedaConta ? Number(valor) : Number(valor) / Number(cotacao)

    const [jaPagoRows] = await pool.query(
      `SELECT COALESCE(SUM(IF(moeda = ?, valor, valor / cotacao)), 0) AS total FROM pagamentos WHERE conta_id = ?`,
      [moedaConta, req.params.id],
    ) as any[]
    const saldoRestante = Number(contaRows[0].valor) - Number(jaPagoRows[0].total)
    if (valorConvertido > saldoRestante + 0.01) {
      return res.status(400).json({ erro: `Valor maior que o saldo restante (${saldoRestante.toFixed(2)} ${moedaConta}).` })
    }

    await pool.query(
      `INSERT INTO pagamentos (conta_id, valor, moeda, cotacao, data_pagamento, forma_pagamento, conta_financeira_id, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id, Number(valor), moedaPagamento, moedaPagamento !== moedaConta ? Number(cotacao) : null,
        data_pagamento, forma_pagamento?.trim() || null, conta_financeira_id ? Number(conta_financeira_id) : null,
        observacao?.trim() || null,
      ],
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
    const { conta_financeira_id } = req.body as { conta_financeira_id?: number }
    const [contaRows] = await pool.query('SELECT valor, moeda FROM contas_a_pagar WHERE id = ?', [req.params.id]) as any[]
    if (!contaRows[0]) return res.status(404).json({ erro: 'Conta não encontrada.' })

    const [jaPagoRows] = await pool.query(
      `SELECT COALESCE(SUM(IF(moeda = ?, valor, valor / cotacao)), 0) AS total FROM pagamentos WHERE conta_id = ?`,
      [contaRows[0].moeda, req.params.id],
    ) as any[]
    const saldoRestante = Number(contaRows[0].valor) - Number(jaPagoRows[0].total)

    if (saldoRestante > 0.01) {
      await pool.query(
        `INSERT INTO pagamentos (conta_id, valor, moeda, data_pagamento, conta_financeira_id) VALUES (?, ?, ?, CURDATE(), ?)`,
        [req.params.id, saldoRestante, contaRows[0].moeda, conta_financeira_id ? Number(conta_financeira_id) : null],
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
