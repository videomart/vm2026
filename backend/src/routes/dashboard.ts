import { Router } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const dashboardRouter = Router()
dashboardRouter.use(requireAuth)

const PERIODOS = ['semana', 'mes', 'ano'] as const
type Periodo = (typeof PERIODOS)[number]

const INICIO_PERIODO: Record<Periodo, string> = {
  semana: 'DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)',
  mes: "DATE_FORMAT(CURDATE(), '%Y-%m-01')",
  ano: "DATE_FORMAT(CURDATE(), '%Y-01-01')",
}

const STATUS_PROPOSTA = ['aberta', 'aprovada', 'recusada', 'convertida'] as const
const STATUS_LEAD = ['novo', 'em_contato', 'convertido', 'descartado'] as const

// ------------------------------------------------------------------
// GET /  — resumo de propostas, vendas e leads no período (semana/mes/ano)
// ------------------------------------------------------------------
dashboardRouter.get('/', async (req, res) => {
  try {
    const periodoParam = req.query.periodo as string | undefined
    const periodo: Periodo = (PERIODOS as readonly string[]).includes(periodoParam ?? '')
      ? (periodoParam as Periodo)
      : 'mes'
    const inicio = INICIO_PERIODO[periodo]

    const [propostasPorStatus] = await pool.query<RowDataPacket[]>(`
      SELECT status, COUNT(*) AS total, COALESCE(SUM(total), 0) AS valor_total
      FROM propostas
      WHERE data >= ${inicio}
      GROUP BY status
    `)

    const porStatusProposta: Record<string, number> = Object.fromEntries(STATUS_PROPOSTA.map((s) => [s, 0]))
    let propostasTotal = 0
    let propostasValor = 0
    for (const row of propostasPorStatus) {
      porStatusProposta[row.status as string] = Number(row.total)
      propostasTotal += Number(row.total)
      propostasValor += Number(row.valor_total)
    }

    const [[vendasResumo]] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS total, COALESCE(SUM(total), 0) AS valor_total
      FROM vendas
      WHERE data >= ${inicio}
    `)

    const [leadsPorStatus] = await pool.query<RowDataPacket[]>(`
      SELECT status, COUNT(*) AS total
      FROM leads
      WHERE criado_em >= ${inicio}
      GROUP BY status
    `)

    const porStatusLead: Record<string, number> = Object.fromEntries(STATUS_LEAD.map((s) => [s, 0]))
    let leadsTotal = 0
    for (const row of leadsPorStatus) {
      porStatusLead[row.status as string] = Number(row.total)
      leadsTotal += Number(row.total)
    }

    res.json({
      periodo,
      propostas: { total: propostasTotal, valor_total: propostasValor, por_status: porStatusProposta },
      vendas: { total: Number(vendasResumo.total), valor_total: Number(vendasResumo.valor_total) },
      leads: { total: leadsTotal, por_status: porStatusLead },
    })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar resumo do dashboard.' })
  }
})
