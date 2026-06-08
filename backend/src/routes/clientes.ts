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
] as const

function dadosCliente(body: any) {
  const dados: Record<string, string | null> = {}
  for (const campo of CAMPOS_EDITAVEIS) {
    if (body[campo] !== undefined) {
      const valor = body[campo]
      dados[campo] = typeof valor === 'string' && valor.trim() === '' ? null : valor
    }
  }
  return dados
}

clientesRouter.get('/', async (req, res) => {
  const busca = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const incluirInativos = req.query.incluirInativos === '1'

  const condicoes: string[] = []
  const parametros: any[] = []

  if (!incluirInativos) {
    condicoes.push('ativo = 1')
  }
  if (busca) {
    condicoes.push('(razao_social LIKE ? OR nome_fantasia LIKE ? OR cnpj_cpf LIKE ?)')
    const termo = `%${busca}%`
    parametros.push(termo, termo, termo)
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
  const [rows] = await pool.query(
    `SELECT id, razao_social, nome_fantasia, cnpj_cpf, email, telefone, whatsapp,
            endereco, cidade, uf, cep, observacoes, ativo, criado_em, atualizado_em
       FROM clientes
       ${where}
       ORDER BY razao_social`,
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
