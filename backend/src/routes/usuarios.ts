import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin, requireAuth } from '../auth/middleware.js'

export const usuariosRouter = Router()

usuariosRouter.use(requireAuth, requireAdmin)

const PAPEIS_VALIDOS = ['admin', 'vendedor'] as const

function dadosUsuario(body: any) {
  const dados: Record<string, unknown> = {}
  if (body.nome !== undefined) dados.nome = body.nome
  if (body.email !== undefined) dados.email = body.email
  if (body.papel !== undefined) dados.papel = body.papel
  return dados
}

usuariosRouter.get('/', async (req, res) => {
  const busca = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const incluirInativos = req.query.incluirInativos === '1'

  const condicoes: string[] = []
  const parametros: any[] = []

  if (!incluirInativos) {
    condicoes.push('ativo = 1')
  }
  if (busca) {
    condicoes.push('(nome LIKE ? OR email LIKE ?)')
    const termo = `%${busca}%`
    parametros.push(termo, termo)
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
  const [rows] = await pool.query(
    `SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ${where} ORDER BY nome`,
    parametros,
  )

  res.json({ usuarios: rows })
})

usuariosRouter.get('/:id', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, nome, email, papel, ativo, criado_em FROM usuarios WHERE id = ?',
    [req.params.id],
  )
  const usuario = (rows as any[])[0]

  if (!usuario) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' })
  }

  res.json({ usuario })
})

usuariosRouter.post('/', async (req, res) => {
  const dados = dadosUsuario(req.body ?? {})
  const senha = (req.body ?? {}).senha as string | undefined

  if (!dados.nome || !dados.email) {
    return res.status(400).json({ erro: 'Informe nome e e-mail.' })
  }
  if (!senha || senha.length < 6) {
    return res.status(400).json({ erro: 'Informe uma senha com ao menos 6 caracteres.' })
  }
  if (dados.papel && !PAPEIS_VALIDOS.includes(dados.papel as any)) {
    return res.status(400).json({ erro: 'Papel inválido.' })
  }

  dados.senha_hash = await bcrypt.hash(senha, 10)
  if (!dados.papel) dados.papel = 'vendedor'

  try {
    const [resultado] = await pool.query('INSERT INTO usuarios SET ?', [dados])
    const id = (resultado as any).insertId
    const [rows] = await pool.query(
      'SELECT id, nome, email, papel, ativo, criado_em FROM usuarios WHERE id = ?',
      [id],
    )
    res.status(201).json({ usuario: (rows as any[])[0] })
  } catch (erro: any) {
    if (erro?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' })
    }
    throw erro
  }
})

usuariosRouter.put('/:id', async (req, res) => {
  const dados = dadosUsuario(req.body ?? {})
  const senha = (req.body ?? {}).senha as string | undefined
  const id = Number(req.params.id)

  if ('nome' in dados && !dados.nome) {
    return res.status(400).json({ erro: 'Informe o nome do usuário.' })
  }
  if ('email' in dados && !dados.email) {
    return res.status(400).json({ erro: 'Informe o e-mail do usuário.' })
  }
  if ('papel' in dados && !PAPEIS_VALIDOS.includes(dados.papel as any)) {
    return res.status(400).json({ erro: 'Papel inválido.' })
  }
  if ('papel' in dados && dados.papel !== 'admin' && id === req.usuario!.id) {
    return res.status(400).json({ erro: 'Não é possível alterar o seu próprio papel.' })
  }
  if (senha) {
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' })
    }
    dados.senha_hash = await bcrypt.hash(senha, 10)
  }

  if (Object.keys(dados).length === 0) {
    return res.status(400).json({ erro: 'Nenhum dado para atualizar.' })
  }

  try {
    const [resultado] = await pool.query('UPDATE usuarios SET ? WHERE id = ?', [dados, id])
    if ((resultado as any).affectedRows === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' })
    }
  } catch (erro: any) {
    if (erro?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' })
    }
    throw erro
  }

  const [rows] = await pool.query(
    'SELECT id, nome, email, papel, ativo, criado_em FROM usuarios WHERE id = ?',
    [id],
  )
  res.json({ usuario: (rows as any[])[0] })
})

usuariosRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (id === req.usuario!.id) {
    return res.status(400).json({ erro: 'Não é possível bloquear o seu próprio usuário.' })
  }

  const [resultado] = await pool.query('UPDATE usuarios SET ativo = 0 WHERE id = ?', [id])
  if ((resultado as any).affectedRows === 0) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' })
  }

  res.status(204).end()
})

usuariosRouter.post('/:id/reativar', async (req, res) => {
  const [resultado] = await pool.query('UPDATE usuarios SET ativo = 1 WHERE id = ?', [
    req.params.id,
  ])
  if ((resultado as any).affectedRows === 0) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' })
  }

  const [rows] = await pool.query(
    'SELECT id, nome, email, papel, ativo, criado_em FROM usuarios WHERE id = ?',
    [req.params.id],
  )
  res.json({ usuario: (rows as any[])[0] })
})
