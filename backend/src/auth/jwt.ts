import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET ?? 'troque_este_segredo_em_producao'
const TOKEN_TTL = '8h'

export type TokenPayload = {
  id: number
  papel: 'admin' | 'vendedor'
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}
