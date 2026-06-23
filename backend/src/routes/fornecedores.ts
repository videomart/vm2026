import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const fornecedoresRouter = Router()
fornecedoresRouter.use(requireAuth)

const CAMPOS_EDITAVEIS = [
  'razao_social',
  'nome_fantasia',
  'cnpj_cpf',
  'email',
  'telefone',
  'observacoes',
] as const

function dadosFornecedor(body: any) {
  const dados: Record<string, string | number | null> = {}
  for (const campo of CAMPOS_EDITAVEIS) {
    if (body[campo] !== undefined) {
      const valor = body[campo]
      dados[campo] = typeof valor === 'string' && valor.trim() === '' ? null : valor
    }
  }
  if (body.cliente_id !== undefined) {
    dados.cliente_id = body.cliente_id ? Number(body.cliente_id) : null
  }
  return dados
}

fornecedoresRouter.get('/', async (req, res) => {
  const busca = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const incluirInativos = req.query.incluirInativos === '1'

  const condicoes: string[] = []
  const parametros: any[] = []
  if (!incluirInativos) condicoes.push('ativo = 1')
  if (busca) {
    condicoes.push('(razao_social LIKE ? OR nome_fantasia LIKE ? OR cnpj_cpf LIKE ?)')
    const termo = `%${busca}%`
    parametros.push(termo, termo, termo)
  }
  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''

  const [rows] = await pool.query(
    `SELECT f.*, c.razao_social AS cliente_vinculado_nome
     FROM fornecedores f
     LEFT JOIN clientes c ON c.id = f.cliente_id
     ${where.replace(/\b(razao_social|nome_fantasia|cnpj_cpf|ativo)\b/g, 'f.$1')}
     ORDER BY f.razao_social`,
    parametros,
  )
  res.json({ fornecedores: rows })
})

fornecedoresRouter.get('/:id', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT f.*, c.razao_social AS cliente_vinculado_nome
     FROM fornecedores f
     LEFT JOIN clientes c ON c.id = f.cliente_id
     WHERE f.id = ?`,
    [req.params.id],
  )
  const fornecedor = (rows as any[])[0]
  if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })
  res.json({ fornecedor })
})

fornecedoresRouter.post('/', async (req, res) => {
  const dados = dadosFornecedor(req.body ?? {})
  if (!dados.razao_social) return res.status(400).json({ erro: 'Informe a razão social do fornecedor.' })

  const [resultado] = await pool.query('INSERT INTO fornecedores SET ?', [dados])
  const id = (resultado as any).insertId
  const [rows] = await pool.query('SELECT * FROM fornecedores WHERE id = ?', [id])
  res.status(201).json({ fornecedor: (rows as any[])[0] })
})

fornecedoresRouter.put('/:id', async (req, res) => {
  const dados = dadosFornecedor(req.body ?? {})
  if ('razao_social' in dados && !dados.razao_social) {
    return res.status(400).json({ erro: 'Informe a razão social do fornecedor.' })
  }
  if (Object.keys(dados).length === 0) return res.status(400).json({ erro: 'Nenhum dado para atualizar.' })

  const [resultado] = await pool.query('UPDATE fornecedores SET ? WHERE id = ?', [dados, req.params.id])
  if ((resultado as any).affectedRows === 0) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })

  const [rows] = await pool.query('SELECT * FROM fornecedores WHERE id = ?', [req.params.id])
  res.json({ fornecedor: (rows as any[])[0] })
})

fornecedoresRouter.delete('/:id', async (req, res) => {
  const [resultado] = await pool.query('UPDATE fornecedores SET ativo = 0 WHERE id = ?', [req.params.id])
  if ((resultado as any).affectedRows === 0) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })
  res.status(204).end()
})

fornecedoresRouter.post('/:id/reativar', async (req, res) => {
  const [resultado] = await pool.query('UPDATE fornecedores SET ativo = 1 WHERE id = ?', [req.params.id])
  if ((resultado as any).affectedRows === 0) return res.status(404).json({ erro: 'Fornecedor não encontrado.' })
  const [rows] = await pool.query('SELECT * FROM fornecedores WHERE id = ?', [req.params.id])
  res.json({ fornecedor: (rows as any[])[0] })
})
