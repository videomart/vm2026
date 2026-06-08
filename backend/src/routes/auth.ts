import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { pool } from '../db.js'
import { COOKIE_NAME, requireAuth } from '../auth/middleware.js'
import { signToken } from '../auth/jwt.js'

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
