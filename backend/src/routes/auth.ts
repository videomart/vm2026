import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { Router } from 'express'
import { pool } from '../db.js'
import { COOKIE_NAME, requireAuth } from '../auth/middleware.js'
import { signToken } from '../auth/jwt.js'
import { enviarEmail } from '../email.js'

export const authRouter = Router()

const isProduction = process.env.NODE_ENV === 'production'

function setSessionCookie(res: import('express').Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  })
}

authRouter.post('/login', async (req, res) => {
  const { email, senha } = req.body ?? {}
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' })
  }

  const [rows] = await pool.query(
    'SELECT id, nome, email, senha_hash, papel, ativo FROM usuarios WHERE email = ?',
    [email],
  )
  const usuario = (rows as any[])[0]

  if (!usuario) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos.' })
  }

  const senhaConfere = await bcrypt.compare(senha, usuario.senha_hash)
  if (!senhaConfere) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos.' })
  }

  if (!usuario.ativo) {
    return res.status(403).json({ erro: 'Usuário inativo. Procure o administrador.' })
  }

  const token = signToken({ id: usuario.id, papel: usuario.papel })
  setSessionCookie(res, token)

  res.json({
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
    },
  })
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME)
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.usuario })
})

authRouter.get('/usuarios', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nome, email, papel FROM usuarios WHERE ativo = 1 ORDER BY nome ASC',
    )
    res.json({ usuarios: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar usuários.' })
  }
})

// ─── Redefinição de senha (esqueci minha senha) ────────────────────────────────

authRouter.post('/esqueci-senha', async (req, res) => {
  // Resposta genérica sempre, mesmo se o e-mail não existir — evita confirmar
  // a um atacante quais e-mails têm conta no sistema (enumeration).
  const RESPOSTA_GENERICA = { ok: true, mensagem: 'Se este e-mail estiver cadastrado, enviamos um link de redefinição.' }
  try {
    const { email } = req.body ?? {}
    if (!email) return res.status(400).json({ erro: 'Informe o e-mail.' })

    const [rows] = await pool.query(
      'SELECT id, nome, email FROM usuarios WHERE email = ? AND ativo = 1',
      [email],
    )
    const usuario = (rows as any[])[0]
    if (!usuario) return res.json(RESPOSTA_GENERICA)

    const token = crypto.randomBytes(32).toString('hex')
    const expiraEm = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await pool.query(
      'INSERT INTO redefinicoes_senha (usuario_id, token, expira_em) VALUES (?, ?, ?)',
      [usuario.id, token, expiraEm],
    )

    const link = `${process.env.FRONTEND_URL ?? 'http://localhost:8082'}/redefinir-senha?token=${token}`
    await enviarEmail({
      to: usuario.email,
      subject: 'Redefinição de senha — vm2026',
      html: `
        <p>Olá, ${usuario.nome}!</p>
        <p>Recebemos uma solicitação para redefinir sua senha no vm2026.</p>
        <p>Clique no link abaixo para escolher uma nova senha (válido por 1 hora):</p>
        <p><a href="${link}">${link}</a></p>
        <p>Se você não solicitou isso, pode ignorar este e-mail — sua senha atual continua válida.</p>
      `,
    })

    res.json(RESPOSTA_GENERICA)
  } catch {
    // mesmo em erro interno, não revela detalhe — apenas loga no servidor
    res.json(RESPOSTA_GENERICA)
  }
})

authRouter.post('/redefinir-senha', async (req, res) => {
  try {
    const { token, novaSenha } = req.body ?? {}
    if (!token || !novaSenha) return res.status(400).json({ erro: 'Token e nova senha são obrigatórios.' })
    if (novaSenha.length < 6) return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' })

    const [rows] = await pool.query(
      `SELECT id, usuario_id, expira_em, usado_em FROM redefinicoes_senha WHERE token = ?`,
      [token],
    )
    const redefinicao = (rows as any[])[0]
    if (!redefinicao) return res.status(400).json({ erro: 'Link inválido ou expirado.' })
    if (redefinicao.usado_em) return res.status(400).json({ erro: 'Este link já foi utilizado.' })
    if (new Date(redefinicao.expira_em) < new Date()) return res.status(400).json({ erro: 'Link expirado. Solicite um novo.' })

    const senhaHash = await bcrypt.hash(novaSenha, 10)
    await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [senhaHash, redefinicao.usuario_id])
    await pool.query('UPDATE redefinicoes_senha SET usado_em = NOW() WHERE id = ?', [redefinicao.id])

    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao redefinir senha.' })
  }
})
