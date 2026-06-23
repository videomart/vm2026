import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

export const produtosRouter = Router()

produtosRouter.use(requireAuth)

const CAMPOS_EDITAVEIS = [
  'modelo',
  'descricao',
  'marca',
  'categoria',
  'tipo_oferta',
  'composicao_hardware',
  'preco_custo',
  'preco_venda',
  'moeda',
  'preco_usd',
  'peso',
] as const

type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number]

function dadosProduto(body: Record<string, unknown>) {
  const dados: Partial<Record<CampoEditavel, unknown>> = {}
  for (const campo of CAMPOS_EDITAVEIS) {
    if (campo in body) dados[campo] = body[campo] === '' ? null : body[campo]
  }
  return dados
}

/** Calcula preço sugerido em BRL para produto cotado em USD */
async function calcularPrecoSugerido(precoUsd: number): Promise<number | null> {
  try {
    const [cotRows] = await pool.query(
      'SELECT valor FROM cotacao_dolar ORDER BY data DESC LIMIT 1',
    )
    const cotacao = (cotRows as any[])[0]?.valor
    if (!cotacao) return null

    const [setupRows] = await pool.query('SELECT fator_markup_usd FROM setup WHERE id = 1')
    const fator = Number((setupRows as any[])[0]?.fator_markup_usd ?? 1.3)

    return Math.round(precoUsd * Number(cotacao) * fator * 100) / 100
  } catch {
    return null
  }
}

produtosRouter.get('/', async (req, res) => {
  try {
    const { q, incluirInativos } = req.query as Record<string, string>
    let sql = 'SELECT * FROM produtos'
    const params: unknown[] = []

    const filtros: string[] = []
    if (!incluirInativos) filtros.push('ativo = 1')
    if (q?.trim()) {
      filtros.push('(modelo LIKE ? OR descricao LIKE ? OR marca LIKE ? OR categoria LIKE ?)')
      const like = `%${q.trim()}%`
      params.push(like, like, like, like)
    }

    if (filtros.length) sql += ' WHERE ' + filtros.join(' AND ')
    sql += ' ORDER BY modelo ASC'

    const [rows] = await pool.query(sql, params)
    res.json({ produtos: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar produtos.' })
  }
})

produtosRouter.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM produtos WHERE id = ?', [req.params.id])
    const produto = (rows as any[])[0]
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado.' })

    let preco_sugerido: number | null = null
    if (produto.moeda === 'USD' && produto.preco_usd) {
      preco_sugerido = await calcularPrecoSugerido(Number(produto.preco_usd))
    }

    res.json({ produto: { ...produto, preco_sugerido } })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar produto.' })
  }
})

produtosRouter.post('/', async (req, res) => {
  try {
    const dados = dadosProduto(req.body)
    if (!dados.modelo) return res.status(400).json({ erro: 'O campo modelo é obrigatório.' })
    const [result] = await pool.query('INSERT INTO produtos SET ?', [dados]) as any[]
    const [rows] = await pool.query('SELECT * FROM produtos WHERE id = ?', [result.insertId])
    res.status(201).json({ produto: (rows as unknown[])[0] })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe um produto com esse modelo.' })
    res.status(500).json({ erro: 'Erro ao criar produto.' })
  }
})

produtosRouter.put('/:id', async (req, res) => {
  try {
    const dados = dadosProduto(req.body)
    if (Object.keys(dados).length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar.' })
    const [result] = await pool.query('UPDATE produtos SET ? WHERE id = ?', [dados, req.params.id]) as any[]
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Produto não encontrado.' })
    const [rows] = await pool.query('SELECT * FROM produtos WHERE id = ?', [req.params.id])
    res.json({ produto: (rows as unknown[])[0] })
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe um produto com esse modelo.' })
    res.status(500).json({ erro: 'Erro ao atualizar produto.' })
  }
})

produtosRouter.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE produtos SET ativo = 0 WHERE id = ? AND ativo = 1', [req.params.id]) as any[]
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Produto não encontrado ou já inativo.' })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao inativar produto.' })
  }
})

produtosRouter.post('/:id/reativar', async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE produtos SET ativo = 1 WHERE id = ? AND ativo = 0', [req.params.id]) as any[]
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Produto não encontrado ou já ativo.' })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao reativar produto.' })
  }
})
