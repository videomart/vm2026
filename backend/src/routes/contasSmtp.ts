import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'

export const contasSmtpRouter = Router()
contasSmtpRouter.use(requireAuth)
contasSmtpRouter.use(requireAdmin)

contasSmtpRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT cs.id, cs.nome, cs.host, cs.port, cs.secure, cs.smtp_user, cs.smtp_from,
             cs.reply_to, cs.limite_dia, cs.ativo, cs.padrao, cs.criado_em,
             COALESCE(u.total_enviado, 0) AS usado_hoje
      FROM contas_smtp cs
      LEFT JOIN contas_smtp_uso u ON u.conta_id = cs.id AND u.data = CURDATE()
      ORDER BY cs.padrao DESC, cs.nome ASC
    `)
    res.json({ contas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar contas SMTP.' })
  }
})

// Marca esta conta como padrão (usada em "esqueci minha senha" e envio
// individual de proposta) — desmarca qualquer outra automaticamente, já que
// só pode existir uma conta padrão por vez.
contasSmtpRouter.post('/:id/tornar-padrao', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('UPDATE contas_smtp SET padrao = 0')
    const [r] = await conn.query('UPDATE contas_smtp SET padrao = 1 WHERE id = ? AND ativo = 1', [req.params.id]) as any[]
    if (r.affectedRows === 0) {
      await conn.rollback()
      return res.status(404).json({ erro: 'Conta não encontrada ou inativa.' })
    }
    await conn.commit()
    res.json({ ok: true })
  } catch {
    await conn.rollback()
    res.status(500).json({ erro: 'Erro ao definir conta padrão.' })
  } finally {
    conn.release()
  }
})

contasSmtpRouter.post('/', async (req, res) => {
  try {
    const { nome, host, port, secure, smtp_user, smtp_pass, smtp_from, reply_to, limite_dia } = req.body
    if (!nome?.trim() || !host?.trim() || !smtp_user?.trim() || !smtp_pass?.trim()) {
      return res.status(400).json({ erro: 'nome, host, smtp_user e smtp_pass são obrigatórios.' })
    }
    const [r] = await pool.query(
      `INSERT INTO contas_smtp (nome, host, port, secure, smtp_user, smtp_pass, smtp_from, reply_to, limite_dia)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome.trim(), host.trim(), Number(port) || 465, secure ? 1 : 0,
        smtp_user.trim(), smtp_pass.trim(), smtp_from?.trim() || null,
        reply_to?.trim() || null, Number(limite_dia) || 100,
      ],
    ) as any[]
    res.status(201).json({ conta: { id: r.insertId } })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma conta com este usuário SMTP.' })
    res.status(500).json({ erro: 'Erro ao criar conta SMTP.' })
  }
})

contasSmtpRouter.put('/:id', async (req, res) => {
  try {
    const { nome, host, port, secure, smtp_user, smtp_pass, smtp_from, reply_to, limite_dia, ativo } = req.body
    if (!nome?.trim() || !host?.trim() || !smtp_user?.trim()) {
      return res.status(400).json({ erro: 'nome, host e smtp_user são obrigatórios.' })
    }
    if (!ativo) {
      const [rows] = await pool.query('SELECT padrao FROM contas_smtp WHERE id = ?', [req.params.id]) as any[]
      if (rows[0]?.padrao) {
        return res.status(409).json({ erro: 'Esta é a conta padrão (usada em "esqueci minha senha" e propostas) — defina outra como padrão antes de desativar.' })
      }
    }
    // senha é opcional na edição: só atualiza se for enviada (evita sobrescrever com vazio)
    const campos = [
      'nome = ?', 'host = ?', 'port = ?', 'secure = ?', 'smtp_user = ?',
      'smtp_from = ?', 'reply_to = ?', 'limite_dia = ?', 'ativo = ?',
    ]
    const valores: unknown[] = [
      nome.trim(), host.trim(), Number(port) || 465, secure ? 1 : 0, smtp_user.trim(),
      smtp_from?.trim() || null, reply_to?.trim() || null, Number(limite_dia) || 100, ativo ? 1 : 0,
    ]
    if (smtp_pass?.trim()) {
      campos.push('smtp_pass = ?')
      valores.push(smtp_pass.trim())
    }
    valores.push(req.params.id)

    await pool.query(`UPDATE contas_smtp SET ${campos.join(', ')} WHERE id = ?`, valores)
    res.json({ ok: true })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma conta com este usuário SMTP.' })
    res.status(500).json({ erro: 'Erro ao atualizar conta SMTP.' })
  }
})

contasSmtpRouter.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT padrao FROM contas_smtp WHERE id = ?', [req.params.id]) as any[]
    if (rows[0]?.padrao) {
      return res.status(409).json({ erro: 'Esta é a conta padrão (usada em "esqueci minha senha" e propostas) — defina outra como padrão antes de remover.' })
    }
    await pool.query('DELETE FROM contas_smtp WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover conta SMTP.' })
  }
})
