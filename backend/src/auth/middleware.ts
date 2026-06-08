import type { NextFunction, Request, Response } from 'express'
import { pool } from '../db.js'
import { verifyToken } from './jwt.js'

export type UsuarioSessao = {
  id: number
  nome: string
  email: string
  papel: 'admin' | 'vendedor'
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioSessao
    }
  }
}

const COOKIE_NAME = 'vm2026_token'
export { COOKIE_NAME }

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ erro: 'Não autenticado.' })
  }

  try {
    const payload = verifyToken(token)
    const [rows] = await pool.query(
      'SELECT id, nome, email, papel, ativo FROM usuarios WHERE id = ?',
      [payload.id],
    )
    const usuario = (rows as any[])[0]

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Usuário inativo ou inexistente.' })
    }

    req.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
    }
    next()
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada.' })
  }
}
