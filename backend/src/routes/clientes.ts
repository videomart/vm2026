import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const clientesRouter = Router()

clientesRouter.use(requireAuth)

const CAMPOS_EDITAVEIS = [
  'razao_social',
  'nome_fantasia',
  'cnpj_cpf',
  'email',
  'telefone',
  'whatsapp',
  'endereco',
  'cidade',
  'uf',
  'cep',
  'observacoes',
  'condicoes_pagamento',
  'categoria_cliente_id',
] as const

function dadosCliente(body: any) {
  const dados: Record<string, string | number | null> = {}
  for (const campo of CAMPOS_EDITAVEIS) {
    if (body[campo] !== undefined) {
      const valor = body[campo]
      if (campo === 'categoria_cliente_id') {
        dados[campo] = valor === '' || valor === null ? null : Number(valor)
      } else {
        dados[campo] = typeof valor === 'string' && valor.trim() === '' ? null : valor
      }
    }
  }
  return dados
}

clientesRouter.get('/', async (req, res) => {
  const busca = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const incluirInativos = req.query.incluirInativos === '1'
  const categoriaId = typeof req.query.categoria_cliente_id === 'string' ? req.query.categoria_cliente_id : ''

  const condicoes: string[] = []
  const parametros: any[] = []

  if (!incluirInativos) {
    condicoes.push('c.ativo = 1')
  }
  if (busca) {
    condicoes.push('(c.razao_social LIKE ? OR c.nome_fantasia LIKE ? OR c.cnpj_cpf LIKE ?)')
    const termo = `%${busca}%`
    parametros.push(termo, termo, termo)
  }
  if (categoriaId) {
    condicoes.push('c.categoria_cliente_id = ?')
    parametros.push(categoriaId)
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
  const [rows] = await pool.query(
    `SELECT c.id, c.razao_social, c.nome_fantasia, c.cnpj_cpf, c.email, c.telefone, c.whatsapp,
            c.endereco, c.cidade, c.uf, c.cep, c.observacoes, c.condicoes_pagamento,
            c.categoria_cliente_id, cc.nome AS categoria_cliente_nome,
            c.ativo, c.criado_em, c.atualizado_em
       FROM clientes c
       LEFT JOIN categorias_cliente cc ON cc.id = c.categoria_cliente_id
       ${where}
       ORDER BY c.razao_social`,
    parametros,
  )

  res.json({ clientes: rows })
})

clientesRouter.get('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM clientes WHERE id = ?', [req.params.id])
  const cliente = (rows as any[])[0]

  if (!cliente) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' })
  }

  res.json({ cliente })
})

clientesRouter.post('/', async (req, res) => {
  const dados = dadosCliente(req.body ?? {})

  if (!dados.razao_social) {
    return res.status(400).json({ erro: 'Informe a razão social do cliente.' })
  }

  const [resultado] = await pool.query('INSERT INTO clientes SET ?', [dados])
  const id = (resultado as any).insertId

  const [rows] = await pool.query('SELECT * FROM clientes WHERE id = ?', [id])
  res.status(201).json({ cliente: (rows as any[])[0] })
})

clientesRouter.put('/:id', async (req, res) => {
  const dados = dadosCliente(req.body ?? {})

  if ('razao_social' in dados && !dados.razao_social) {
    return res.status(400).json({ erro: 'Informe a razão social do cliente.' })
  }
  if (Object.keys(dados).length === 0) {
    return res.status(400).json({ erro: 'Nenhum dado para atualizar.' })
  }

  const [resultado] = await pool.query('UPDATE clientes SET ? WHERE id = ?', [
    dados,
    req.params.id,
  ])
  if ((resultado as any).affectedRows === 0) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' })
  }

  const [rows] = await pool.query('SELECT * FROM clientes WHERE id = ?', [req.params.id])
  res.json({ cliente: (rows as any[])[0] })
})

clientesRouter.delete('/:id', async (req, res) => {
  const [resultado] = await pool.query('UPDATE clientes SET ativo = 0 WHERE id = ?', [
    req.params.id,
  ])
  if ((resultado as any).affectedRows === 0) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' })
  }

  res.status(204).end()
})

clientesRouter.post('/:id/reativar', async (req, res) => {
  const [resultado] = await pool.query('UPDATE clientes SET ativo = 1 WHERE id = ?', [
    req.params.id,
  ])
  if ((resultado as any).affectedRows === 0) {
    return res.status(404).json({ erro: 'Cliente não encontrado.' })
  }

  const [rows] = await pool.query('SELECT * FROM clientes WHERE id = ?', [req.params.id])
  res.json({ cliente: (rows as any[])[0] })
})

// ─── Contatos do cliente ───────────────────────────────────────────────────────

clientesRouter.get('/:id/contatos', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, nome, telefone, email FROM contatos WHERE cliente_id = ? AND ativo = 1 ORDER BY nome ASC',
    [req.params.id],
  )
  res.json({ contatos: rows })
})

clientesRouter.post('/:id/contatos', async (req, res) => {
  const { nome, telefone, email } = req.body
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
  const [r] = await pool.query(
    'INSERT INTO contatos (cliente_id, nome, telefone, email) VALUES (?, ?, ?, ?)',
    [req.params.id, nome.trim(), telefone?.trim() || null, email?.trim() || null],
  ) as any[]
  res.status(201).json({ contato: { id: r.insertId, nome: nome.trim(), telefone: telefone?.trim() || null, email: email?.trim() || null } })
})

clientesRouter.put('/:id/contatos/:cid', async (req, res) => {
  const { nome, telefone, email } = req.body
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
  await pool.query(
    'UPDATE contatos SET nome = ?, telefone = ?, email = ? WHERE id = ? AND cliente_id = ?',
    [nome.trim(), telefone?.trim() || null, email?.trim() || null, req.params.cid, req.params.id],
  )
  res.json({ ok: true })
})

clientesRouter.delete('/:id/contatos/:cid', async (req, res) => {
  await pool.query('UPDATE contatos SET ativo = 0 WHERE id = ? AND cliente_id = ?', [req.params.cid, req.params.id])
  res.json({ ok: true })
})
