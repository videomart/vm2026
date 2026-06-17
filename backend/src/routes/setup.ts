import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'

export const setupRouter = Router()

// ─── Setup global ─────────────────────────────────────────────────────────────

setupRouter.get('/', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM setup WHERE id = 1')
    res.json({ setup: (rows as any[])[0] ?? null })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar configurações.' })
  }
})

setupRouter.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      empresa_nome, empresa_cnpj, empresa_endereco,
      empresa_telefone, empresa_email, empresa_site,
      fator_markup_usd, proposta_validade_dias, observacoes_padrao,
      smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, smtp_limite_hora,
    } = req.body
    await pool.query(
      `UPDATE setup SET
         empresa_nome = ?, empresa_cnpj = ?, empresa_endereco = ?,
         empresa_telefone = ?, empresa_email = ?, empresa_site = ?,
         fator_markup_usd = ?, proposta_validade_dias = ?, observacoes_padrao = ?,
         smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_user = ?,
         smtp_pass = ?, smtp_from = ?, smtp_limite_hora = ?
       WHERE id = 1`,
      [
        empresa_nome ?? 'Videomart Broadcast',
        empresa_cnpj ?? null,
        empresa_endereco ?? null,
        empresa_telefone ?? null,
        empresa_email ?? null,
        empresa_site ?? null,
        Number(fator_markup_usd) || 1.3,
        Number(proposta_validade_dias) || 30,
        observacoes_padrao ?? null,
        smtp_host?.trim() || null,
        smtp_port ? Number(smtp_port) : null,
        smtp_secure != null ? (smtp_secure ? 1 : 0) : null,
        smtp_user?.trim() || null,
        smtp_pass?.trim() || null,
        smtp_from?.trim() || null,
        smtp_limite_hora ? Number(smtp_limite_hora) : 100,
      ],
    )
    const [rows] = await pool.query('SELECT * FROM setup WHERE id = 1')
    res.json({ setup: (rows as any[])[0] })
  } catch {
    res.status(500).json({ erro: 'Erro ao salvar configurações.' })
  }
})

// ─── Condições de pagamento ────────────────────────────────────────────────────

setupRouter.get('/condicoes', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, descricao, corpo FROM condicoes_pagamento WHERE ativo = 1 ORDER BY descricao ASC',
    )
    res.json({ condicoes: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar condições de pagamento.' })
  }
})

setupRouter.post('/condicoes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { descricao, corpo } = req.body
    if (!descricao?.trim()) return res.status(400).json({ erro: 'Descrição é obrigatória.' })
    const [r] = await pool.query(
      'INSERT INTO condicoes_pagamento (descricao, corpo) VALUES (?, ?)',
      [descricao.trim(), corpo?.trim() ?? null],
    ) as any[]
    res.status(201).json({ condicao: { id: r.insertId, descricao: descricao.trim(), corpo: corpo?.trim() ?? null } })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Condição já cadastrada.' })
    res.status(500).json({ erro: 'Erro ao salvar condição.' })
  }
})

setupRouter.put('/condicoes/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { descricao, corpo } = req.body
    if (!descricao?.trim()) return res.status(400).json({ erro: 'Descrição é obrigatória.' })
    await pool.query(
      'UPDATE condicoes_pagamento SET descricao = ?, corpo = ? WHERE id = ?',
      [descricao.trim(), corpo?.trim() ?? null, req.params.id],
    )
    res.json({ ok: true })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Condição já cadastrada.' })
    res.status(500).json({ erro: 'Erro ao salvar condição.' })
  }
})

setupRouter.delete('/condicoes/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE condicoes_pagamento SET ativo = 0 WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover condição.' })
  }
})

// ─── Cotação do dólar ──────────────────────────────────────────────────────────

setupRouter.get('/cotacao', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM cotacao_dolar ORDER BY data DESC LIMIT 1',
    )
    const hoje = (rows as any[])[0] ?? null
    const [historico] = await pool.query(
      'SELECT data, valor FROM cotacao_dolar ORDER BY data DESC LIMIT 30',
    )
    res.json({ cotacao: hoje, historico })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar cotação.' })
  }
})

setupRouter.post('/cotacao', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, valor, fonte } = req.body
    if (!data || !valor) return res.status(400).json({ erro: 'Data e valor são obrigatórios.' })
    await pool.query(
      `INSERT INTO cotacao_dolar (data, valor, fonte) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor), fonte = VALUES(fonte)`,
      [data, Number(valor), fonte ?? 'manual'],
    )
    const [rows] = await pool.query('SELECT * FROM cotacao_dolar WHERE data = ?', [data])
    res.json({ cotacao: (rows as any[])[0] })
  } catch {
    res.status(500).json({ erro: 'Erro ao salvar cotação.' })
  }
})
