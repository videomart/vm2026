import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const contasReceberRouter = Router()
contasReceberRouter.use(requireAuth)

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

// Recebimentos podem estar em moeda diferente da conta — converte pela cotação
// informada no momento do pagamento antes de somar ao total recebido.
const SQL_VALOR_RECEBIDO_CONVERTIDO = `
  COALESCE((
    SELECT SUM(IF(r.moeda = cr.moeda, r.valor, r.valor / r.cotacao))
    FROM recebimentos r WHERE r.conta_id = cr.id
  ), 0)
`

// ─── Relatório (resumo por status + lista detalhada no período) ────────────────

contasReceberRouter.get('/relatorio', async (req, res) => {
  try {
    const periodoParam = req.query.periodo as string | undefined
    const periodo: Periodo = (PERIODOS as readonly string[]).includes(periodoParam ?? '')
      ? (periodoParam as Periodo)
      : 'mes'
    const inicio = INICIO_PERIODO[periodo]
    const fim = FIM_PERIODO[periodo]

    await pool.query(
      `UPDATE contas_a_receber SET status = 'atrasado' WHERE status = 'pendente' AND vencimento < CURDATE()`,
    )

    const [porStatus] = await pool.query(`
      SELECT cr.status, COUNT(*) AS total, COALESCE(SUM(cr.valor), 0) AS valor_total,
             COALESCE(SUM(${SQL_VALOR_RECEBIDO_CONVERTIDO}), 0) AS valor_recebido
      FROM contas_a_receber cr
      WHERE cr.vencimento BETWEEN ${inicio} AND ${fim}
      GROUP BY cr.status
    `) as any[]

    const resumo: Record<string, { total: number; valor_total: number; valor_recebido: number }> = {
      pendente: { total: 0, valor_total: 0, valor_recebido: 0 },
      parcial: { total: 0, valor_total: 0, valor_recebido: 0 },
      pago: { total: 0, valor_total: 0, valor_recebido: 0 },
      atrasado: { total: 0, valor_total: 0, valor_recebido: 0 },
    }
    for (const row of porStatus as any[]) {
      resumo[row.status] = {
        total: Number(row.total),
        valor_total: Number(row.valor_total),
        valor_recebido: Number(row.valor_recebido),
      }
    }

    const [contas] = await pool.query(`
      SELECT cr.id, cr.descricao, cr.valor, cr.vencimento, cr.status, cr.pago_em,
             cr.origem_tipo, cr.numero_parcela, cr.total_parcelas,
             c.razao_social AS cliente_nome,
             u.nome AS vendedor_nome,
             ${SQL_VALOR_RECEBIDO_CONVERTIDO} AS total_recebido
      FROM contas_a_receber cr
      LEFT JOIN vendas v ON v.id = cr.venda_id
      JOIN clientes c ON c.id = cr.cliente_id
      LEFT JOIN usuarios u ON u.id = v.vendedor_id
      WHERE cr.vencimento BETWEEN ${inicio} AND ${fim}
      ORDER BY cr.vencimento ASC
    `)

    res.json({ periodo, resumo, contas })
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar relatório de contas a receber.' })
  }
})

async function recalcularStatus(contaId: number) {
  const [rows] = await pool.query(
    `SELECT cr.valor, cr.vencimento, cr.status,
            ${SQL_VALOR_RECEBIDO_CONVERTIDO} AS total_recebido
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

// Lançamento manual (sem venda/assinatura associada) — ex.: recebimento avulso
contasReceberRouter.post('/', async (req, res) => {
  try {
    const { cliente_id, descricao, valor, moeda, vencimento, parcelas } = req.body
    if (!cliente_id) return res.status(400).json({ erro: 'Selecione o cliente.' })
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
          `INSERT INTO contas_a_receber
             (origem_tipo, cliente_id, numero_parcela, total_parcelas, descricao, valor, moeda, vencimento)
           VALUES ('manual', ?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(cliente_id), i + 1, totalParcelas, descricao?.trim() || null,
            valorParcela, (moeda || 'BRL').toUpperCase(), dataVencimento.toISOString().slice(0, 10),
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
    res.status(500).json({ erro: 'Erro ao lançar conta a receber.' })
  }
})

// Edição: só permitida se a conta ainda não tiver nenhum recebimento (senão os
// valores já baixados ficariam dissociados do valor/vencimento exibido).
contasReceberRouter.put('/:id', async (req, res) => {
  try {
    const [contaRows] = await pool.query(
      `SELECT cr.status, cr.origem_tipo,
              ${SQL_VALOR_RECEBIDO_CONVERTIDO} AS total_recebido
       FROM contas_a_receber cr WHERE cr.id = ?`,
      [req.params.id],
    ) as any[]
    const conta = contaRows[0]
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada.' })
    if (Number(conta.total_recebido) > 0) {
      return res.status(409).json({ erro: 'Esta conta já possui recebimentos e não pode ser editada. Reabra-a primeiro.' })
    }

    const { cliente_id, descricao, valor, moeda, vencimento } = req.body
    if (!valor || Number(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor válido.' })
    if (!vencimento) return res.status(400).json({ erro: 'Informe o vencimento.' })

    if (conta.origem_tipo === 'manual') {
      if (!cliente_id) return res.status(400).json({ erro: 'Selecione o cliente.' })
      await pool.query(
        `UPDATE contas_a_receber SET cliente_id = ?, descricao = ?, valor = ?, moeda = ?, vencimento = ? WHERE id = ?`,
        [Number(cliente_id), descricao?.trim() || null, Number(valor), (moeda || 'BRL').toUpperCase(), vencimento, req.params.id],
      )
    } else {
      // venda/assinatura: cliente vem da origem, não é editável aqui
      await pool.query(
        `UPDATE contas_a_receber SET descricao = ?, valor = ?, moeda = ?, vencimento = ? WHERE id = ?`,
        [descricao?.trim() || null, Number(valor), (moeda || 'BRL').toUpperCase(), vencimento, req.params.id],
      )
    }
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao salvar conta a receber.' })
  }
})

// Exclusão: só permitida se a conta ainda não tiver recebimento algum (nem
// parcial). Se vier de uma venda, reverte a venda (volta a proposta para aberta).
contasReceberRouter.delete('/:id', async (req, res) => {
  try {
    const [contaRows] = await pool.query(
      `SELECT cr.venda_id, ${SQL_VALOR_RECEBIDO_CONVERTIDO} AS total_recebido
       FROM contas_a_receber cr WHERE cr.id = ?`,
      [req.params.id],
    ) as any[]
    const conta = contaRows[0]
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada.' })
    if (Number(conta.total_recebido) > 0) {
      return res.status(409).json({ erro: 'Esta conta já possui recebimentos e não pode ser excluída. Reabra-a primeiro.' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('DELETE FROM contas_a_receber WHERE id = ?', [req.params.id])
      if (conta.venda_id) {
        const [vendaRows] = await conn.query('SELECT proposta_id FROM vendas WHERE id = ?', [conta.venda_id]) as any[]
        await conn.query('DELETE FROM vendas WHERE id = ?', [conta.venda_id])
        if (vendaRows[0]?.proposta_id) {
          await conn.query(`UPDATE propostas SET status = 'aberta' WHERE id = ?`, [vendaRows[0].proposta_id])
        }
      }
      await conn.commit()
      res.status(204).end()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  } catch {
    res.status(500).json({ erro: 'Erro ao excluir conta a receber.' })
  }
})

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
      SELECT cr.id, cr.descricao, cr.valor, cr.moeda, cr.vencimento, cr.status, cr.pago_em, cr.criado_em,
             cr.origem_tipo, cr.numero_parcela, cr.total_parcelas,
             cr.venda_id, v.proposta_id,
             cr.assinatura_id, a.descricao AS assinatura_descricao,
             c.id AS cliente_id, c.razao_social AS cliente_nome,
             u.nome AS vendedor_nome,
             ${SQL_VALOR_RECEBIDO_CONVERTIDO} AS total_recebido
      FROM contas_a_receber cr
      LEFT JOIN vendas v ON v.id = cr.venda_id
      LEFT JOIN assinaturas a ON a.id = cr.assinatura_id
      JOIN clientes c ON c.id = cr.cliente_id
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
        `INSERT INTO contas_a_receber (origem_tipo, assinatura_id, cliente_id, descricao, valor, vencimento)
         VALUES ('assinatura', ?, ?, ?, ?, ?)`,
        [a.id, a.cliente_id, a.descricao, a.valor_mensal, vencimento],
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
      `SELECT r.id, r.valor, r.moeda, r.cotacao, r.data_pagamento, r.forma_pagamento, r.observacao, r.criado_em,
              r.conta_financeira_id, cf.nome AS conta_financeira_nome
       FROM recebimentos r
       LEFT JOIN contas_financeiras cf ON cf.id = r.conta_financeira_id
       WHERE r.conta_id = ? ORDER BY r.data_pagamento DESC`,
      [req.params.id],
    )
    res.json({ recebimentos: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar recebimentos.' })
  }
})

contasReceberRouter.post('/:id/recebimentos', async (req, res) => {
  try {
    const { valor, moeda, cotacao, data_pagamento, forma_pagamento, conta_financeira_id, observacao } = req.body
    if (!valor || Number(valor) <= 0) return res.status(400).json({ erro: 'Informe um valor válido.' })
    if (!data_pagamento) return res.status(400).json({ erro: 'Informe a data do pagamento.' })

    const [contaRows] = await pool.query('SELECT valor, moeda FROM contas_a_receber WHERE id = ?', [req.params.id]) as any[]
    if (!contaRows[0]) return res.status(404).json({ erro: 'Conta não encontrada.' })

    const moedaConta = contaRows[0].moeda
    const moedaPagamento = (moeda || moedaConta).toUpperCase()
    if (moedaPagamento !== moedaConta && !(Number(cotacao) > 0)) {
      return res.status(400).json({ erro: `Informe a cotação para converter de ${moedaPagamento} para ${moedaConta}.` })
    }
    const valorConvertido = moedaPagamento === moedaConta ? Number(valor) : Number(valor) / Number(cotacao)

    const [jaRecebidoRows] = await pool.query(
      `SELECT COALESCE(SUM(IF(moeda = ?, valor, valor / cotacao)), 0) AS total FROM recebimentos WHERE conta_id = ?`,
      [moedaConta, req.params.id],
    ) as any[]
    const saldoRestante = Number(contaRows[0].valor) - Number(jaRecebidoRows[0].total)
    if (valorConvertido > saldoRestante + 0.01) {
      return res.status(400).json({ erro: `Valor maior que o saldo restante (${saldoRestante.toFixed(2)} ${moedaConta}).` })
    }

    await pool.query(
      `INSERT INTO recebimentos (conta_id, valor, moeda, cotacao, data_pagamento, forma_pagamento, conta_financeira_id, observacao)
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
    const { conta_financeira_id } = req.body as { conta_financeira_id?: number }
    const [contaRows] = await pool.query('SELECT valor, moeda FROM contas_a_receber WHERE id = ?', [req.params.id]) as any[]
    if (!contaRows[0]) return res.status(404).json({ erro: 'Conta não encontrada.' })

    const [jaRecebidoRows] = await pool.query(
      `SELECT COALESCE(SUM(IF(moeda = ?, valor, valor / cotacao)), 0) AS total FROM recebimentos WHERE conta_id = ?`,
      [contaRows[0].moeda, req.params.id],
    ) as any[]
    const saldoRestante = Number(contaRows[0].valor) - Number(jaRecebidoRows[0].total)

    if (saldoRestante > 0.01) {
      await pool.query(
        `INSERT INTO recebimentos (conta_id, valor, moeda, data_pagamento, conta_financeira_id) VALUES (?, ?, ?, CURDATE(), ?)`,
        [req.params.id, saldoRestante, contaRows[0].moeda, conta_financeira_id ? Number(conta_financeira_id) : null],
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

