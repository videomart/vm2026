import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'

export const setupRouter = Router()

// ─── Logo da empresa ──────────────────────────────────────────────────────────
// Duas variantes: logo_base64 (fundo branco, usada no PDF de propostas) e
// logo_interface_base64 (pensada para fundo escuro, usada na sidebar/header/login
// da interface) — a mesma imagem raramente funciona bem nos dois contextos.

const COLUNA_LOGO: Record<string, string> = {
  pdf: 'logo_base64',
  interface: 'logo_interface_base64',
}

function colunaLogo(variante: unknown): string | null {
  return COLUNA_LOGO[String(variante)] ?? null
}

setupRouter.get('/logo/:variante', async (req, res) => {
  const coluna = colunaLogo(req.params.variante)
  if (!coluna) return res.status(404).end()
  try {
    const [rows] = await pool.query(`SELECT ${coluna} AS logo FROM setup WHERE id = 1`)
    const logo = (rows as any[])[0]?.logo
    if (!logo) return res.status(404).end()
    const matches = logo.match(/^data:([^;]+);base64,(.+)$/)
    if (!matches) return res.status(400).end()
    const buf = Buffer.from(matches[2], 'base64')
    res.setHeader('Content-Type', matches[1])
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(buf)
  } catch {
    res.status(500).end()
  }
})

setupRouter.put('/logo/:variante', requireAuth, requireAdmin, async (req, res) => {
  const coluna = colunaLogo(req.params.variante)
  if (!coluna) return res.status(404).end()
  try {
    const { logo_base64 } = req.body
    if (!logo_base64) {
      await pool.query(`UPDATE setup SET ${coluna} = NULL WHERE id = 1`)
    } else {
      if (!logo_base64.startsWith('data:image/')) return res.status(400).json({ erro: 'Formato inválido.' })
      await pool.query(`UPDATE setup SET ${coluna} = ? WHERE id = 1`, [logo_base64])
    }
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao salvar logo.' })
  }
})

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
      envio_intervalo_segundos, envio_lote_tamanho, envio_lote_pausa_segundos,
      lembrete_proposta_dias, lead_sem_contato_horas, parcela_vencimento_dias_aviso,
      saas_geracao_dias_aviso,
    } = req.body
    await pool.query(
      `UPDATE setup SET
         empresa_nome = ?, empresa_cnpj = ?, empresa_endereco = ?,
         empresa_telefone = ?, empresa_email = ?, empresa_site = ?,
         fator_markup_usd = ?, proposta_validade_dias = ?, observacoes_padrao = ?,
         envio_intervalo_segundos = ?, envio_lote_tamanho = ?, envio_lote_pausa_segundos = ?,
         lembrete_proposta_dias = ?, lead_sem_contato_horas = ?, parcela_vencimento_dias_aviso = ?,
         saas_geracao_dias_aviso = ?
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
        envio_intervalo_segundos ? Number(envio_intervalo_segundos) : 10,
        envio_lote_tamanho ? Number(envio_lote_tamanho) : 25,
        envio_lote_pausa_segundos ? Number(envio_lote_pausa_segundos) : 300,
        lembrete_proposta_dias != null ? Number(lembrete_proposta_dias) : 3,
        lead_sem_contato_horas != null ? Number(lead_sem_contato_horas) : 24,
        parcela_vencimento_dias_aviso != null ? Number(parcela_vencimento_dias_aviso) : 3,
        saas_geracao_dias_aviso != null ? Number(saas_geracao_dias_aviso) : 5,
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
