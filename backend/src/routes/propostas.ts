import { Router } from 'express'
import type { PoolConnection } from 'mysql2/promise'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { enviarEmail } from '../email.js'
import { gerarHtmlProposta, gerarPdfProposta } from '../pdf.js'

export const propostasRouter = Router()
propostasRouter.use(requireAuth)

type ItemInput = {
  produto_id?: number | null
  descricao: string
  quantidade: number
  valor_unitario: number
  desconto?: number
}

function calcSubtotal(qtd: number, unit: number, desc: number): number {
  return Math.max(0, Math.round((qtd * unit - desc) * 100) / 100)
}

function calcTotal(subtotais: number[], desconto: number): number {
  const soma = subtotais.reduce((a, b) => a + b, 0)
  return Math.max(0, Math.round((soma - desconto) * 100) / 100)
}

async function salvarItens(conn: PoolConnection, propostaId: number, itens: ItemInput[]) {
  await conn.query('DELETE FROM proposta_itens WHERE proposta_id = ?', [propostaId])
  if (!itens.length) return 0

  const rows = itens.map((item) => {
    const sub = calcSubtotal(item.quantidade, item.valor_unitario, item.desconto ?? 0)
    return [
      propostaId,
      item.produto_id ?? null,
      item.descricao,
      item.quantidade,
      item.valor_unitario,
      item.desconto ?? 0,
      sub,
    ]
  })

  await conn.query(
    `INSERT INTO proposta_itens
       (proposta_id, produto_id, descricao, quantidade, valor_unitario, desconto, subtotal)
     VALUES ?`,
    [rows],
  )

  const subtotais = itens.map((item) => calcSubtotal(item.quantidade, item.valor_unitario, item.desconto ?? 0))
  return subtotais.reduce((a, b) => a + b, 0)
}

// ------------------------------------------------------------------
// GET /  — lista com nome do cliente e vendedor
// ------------------------------------------------------------------
propostasRouter.get('/', async (req, res) => {
  try {
    const { status, q, clienteId } = req.query as Record<string, string>
    let sql = `
      SELECT p.id, p.data, p.validade, p.status, p.total, p.desconto,
             c.razao_social AS cliente_nome, u.nome AS vendedor_nome
      FROM propostas p
      JOIN clientes c ON c.id = p.cliente_id
      JOIN usuarios u ON u.id = p.vendedor_id
    `
    const params: unknown[] = []
    const filtros: string[] = []
    if (status) { filtros.push('p.status = ?'); params.push(status) }
    if (clienteId) { filtros.push('p.cliente_id = ?'); params.push(Number(clienteId)) }
    if (q?.trim()) {
      filtros.push('(c.razao_social LIKE ? OR c.nome_fantasia LIKE ?)')
      params.push(`%${q.trim()}%`, `%${q.trim()}%`)
    }
    if (filtros.length) sql += ' WHERE ' + filtros.join(' AND ')
    sql += ' ORDER BY p.criado_em DESC'

    const [rows] = await pool.query(sql, params)
    res.json({ propostas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar propostas.' })
  }
})

// ------------------------------------------------------------------
// GET /:id — detalhe com itens
// ------------------------------------------------------------------
propostasRouter.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*,
              c.razao_social AS cliente_nome,
              c.nome_fantasia AS cliente_fantasia,
              c.cnpj_cpf AS cliente_cnpj_cpf,
              c.endereco AS cliente_endereco,
              c.cidade AS cliente_cidade,
              c.uf AS cliente_uf,
              c.cep AS cliente_cep,
              c.telefone AS cliente_telefone,
              c.whatsapp AS cliente_whatsapp,
              c.email AS cliente_email,
              u.nome AS vendedor_nome,
              u.email AS vendedor_email
       FROM propostas p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = p.vendedor_id
       WHERE p.id = ?`,
      [req.params.id],
    )
    const proposta = (rows as any[])[0]
    if (!proposta) return res.status(404).json({ erro: 'Proposta não encontrada.' })

    const [itens] = await pool.query(
      `SELECT pi.*, prod.modelo AS produto_modelo
       FROM proposta_itens pi
       LEFT JOIN produtos prod ON prod.id = pi.produto_id
       WHERE pi.proposta_id = ?
       ORDER BY pi.id ASC`,
      [req.params.id],
    )
    res.json({ proposta: { ...proposta, itens } })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar proposta.' })
  }
})

// ------------------------------------------------------------------
// POST /  — criar proposta com itens
// ------------------------------------------------------------------
propostasRouter.post('/', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const { cliente_id, vendedor_id, data, validade, condicoes_pagamento, observacoes, desconto, itens } = req.body
    if (!cliente_id) return res.status(400).json({ erro: 'Cliente é obrigatório.' })
    if (!data) return res.status(400).json({ erro: 'Data é obrigatória.' })

    const desc = Number(desconto ?? 0)
    const listaItens: ItemInput[] = Array.isArray(itens) ? itens : []
    if (!listaItens.length) return res.status(400).json({ erro: 'A proposta precisa ter ao menos um item.' })

    const [result] = await conn.query(
      `INSERT INTO propostas (cliente_id, vendedor_id, data, validade, condicoes_pagamento, observacoes, desconto, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [cliente_id, vendedor_id ?? req.usuario!.id, data, validade || null, condicoes_pagamento || null, observacoes || null, desc],
    ) as any[]

    const propostaId = result.insertId
    const somaItens = await salvarItens(conn, propostaId, listaItens)
    const total = calcTotal([somaItens], desc)

    await conn.query('UPDATE propostas SET total = ? WHERE id = ?', [total, propostaId])
    await conn.commit()

    const [rows] = await pool.query('SELECT * FROM propostas WHERE id = ?', [propostaId])
    res.status(201).json({ proposta: (rows as any[])[0] })
  } catch (err: any) {
    await conn.rollback()
    console.error('Erro ao criar proposta:', err)
    if (err?.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ erro: 'Cliente ou vendedor inválido.' })
    res.status(500).json({ erro: 'Erro ao criar proposta.' })
  } finally {
    conn.release()
  }
})

// ------------------------------------------------------------------
// PUT /:id — editar (só se status = 'aberta')
// ------------------------------------------------------------------
propostasRouter.put('/:id', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [existRows] = await conn.query('SELECT * FROM propostas WHERE id = ? FOR UPDATE', [req.params.id])
    const proposta = (existRows as any[])[0]
    if (!proposta) { await conn.rollback(); return res.status(404).json({ erro: 'Proposta não encontrada.' }) }
    if (proposta.status !== 'aberta') { await conn.rollback(); return res.status(409).json({ erro: 'Só é possível editar propostas com status "aberta".' }) }

    const { cliente_id, vendedor_id, data, validade, condicoes_pagamento, observacoes, desconto, itens } = req.body
    const desc = Number(desconto ?? proposta.desconto)
    const listaItens: ItemInput[] = Array.isArray(itens) ? itens : []
    if (!listaItens.length) { await conn.rollback(); return res.status(400).json({ erro: 'A proposta precisa ter ao menos um item.' }) }

    await conn.query(
      `UPDATE propostas SET cliente_id = ?, vendedor_id = ?, data = ?, validade = ?,
       condicoes_pagamento = ?, observacoes = ?, desconto = ? WHERE id = ?`,
      [
        cliente_id ?? proposta.cliente_id,
        vendedor_id ?? proposta.vendedor_id,
        data ?? proposta.data,
        validade !== undefined ? (validade || null) : proposta.validade,
        condicoes_pagamento !== undefined ? (condicoes_pagamento || null) : proposta.condicoes_pagamento,
        observacoes !== undefined ? (observacoes || null) : proposta.observacoes,
        desc,
        req.params.id,
      ],
    )

    const somaItens = await salvarItens(conn, Number(req.params.id), listaItens)
    const total = calcTotal([somaItens], desc)
    await conn.query('UPDATE propostas SET total = ? WHERE id = ?', [total, req.params.id])
    await conn.commit()

    const [rows] = await pool.query('SELECT * FROM propostas WHERE id = ?', [req.params.id])
    res.json({ proposta: (rows as any[])[0] })
  } catch {
    await conn.rollback()
    res.status(500).json({ erro: 'Erro ao atualizar proposta.' })
  } finally {
    conn.release()
  }
})

// ------------------------------------------------------------------
// POST /:id/status — mudar para aprovada ou recusada
// ------------------------------------------------------------------
propostasRouter.post('/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    const permitidos = ['aprovada', 'recusada']
    if (!permitidos.includes(status)) return res.status(400).json({ erro: 'Status inválido. Use "aprovada" ou "recusada".' })

    const [existRows] = await pool.query('SELECT status FROM propostas WHERE id = ?', [req.params.id])
    const proposta = (existRows as any[])[0]
    if (!proposta) return res.status(404).json({ erro: 'Proposta não encontrada.' })
    if (proposta.status === 'convertida') return res.status(409).json({ erro: 'Proposta já convertida em venda.' })

    await pool.query('UPDATE propostas SET status = ? WHERE id = ?', [status, req.params.id])
    res.json({ ok: true, status })
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar status.' })
  }
})

// Exclusão permanente — só permitida para propostas recusadas (perdidas). Propostas
// abertas/aprovadas não podem ser excluídas (evita perder histórico em negociação),
// e convertidas nunca (já geraram venda/conta a receber).
propostasRouter.delete('/:id', async (req, res) => {
  try {
    const [existRows] = await pool.query('SELECT status FROM propostas WHERE id = ?', [req.params.id])
    const proposta = (existRows as any[])[0]
    if (!proposta) return res.status(404).json({ erro: 'Proposta não encontrada.' })
    if (proposta.status !== 'recusada') {
      return res.status(409).json({ erro: 'Só é possível excluir propostas recusadas (perdidas).' })
    }

    await pool.query('DELETE FROM propostas WHERE id = ?', [req.params.id])
    res.status(204).end()
  } catch {
    res.status(500).json({ erro: 'Erro ao excluir proposta.' })
  }
})

// ------------------------------------------------------------------
// POST /:id/converter — converte em venda + conta a receber
// ------------------------------------------------------------------
propostasRouter.post('/:id/converter', async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [existRows] = await conn.query('SELECT * FROM propostas WHERE id = ? FOR UPDATE', [req.params.id])
    const proposta = (existRows as any[])[0]
    if (!proposta) { await conn.rollback(); return res.status(404).json({ erro: 'Proposta não encontrada.' }) }
    if (proposta.status === 'convertida') { await conn.rollback(); return res.status(409).json({ erro: 'Proposta já foi convertida.' }) }

    const numeroParcelas = Math.max(1, Number(req.body?.numero_parcelas) || 1)

    await conn.query('UPDATE propostas SET status = ? WHERE id = ?', ['convertida', req.params.id])

    const [vendaResult] = await conn.query(
      `INSERT INTO vendas (proposta_id, cliente_id, vendedor_id, data, total)
       VALUES (?, ?, ?, CURDATE(), ?)`,
      [req.params.id, proposta.cliente_id, proposta.vendedor_id, proposta.total],
    ) as any[]

    const vendaId = vendaResult.insertId
    const primeiroVencimento = proposta.validade
      ? new Date(proposta.validade)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const total = Number(proposta.total)
    const valorParcela = Math.floor((total / numeroParcelas) * 100) / 100
    const valorUltimaParcela = Math.round((total - valorParcela * (numeroParcelas - 1)) * 100) / 100

    for (let i = 0; i < numeroParcelas; i++) {
      const vencimento = new Date(primeiroVencimento)
      vencimento.setMonth(vencimento.getMonth() + i)
      const valor = i === numeroParcelas - 1 ? valorUltimaParcela : valorParcela
      const descricao = numeroParcelas > 1
        ? `Venda #${vendaId} — parcela ${i + 1}/${numeroParcelas}`
        : `Venda #${vendaId}`

      await conn.query(
        `INSERT INTO contas_a_receber
           (venda_id, origem_tipo, cliente_id, numero_parcela, total_parcelas, descricao, valor, vencimento)
         VALUES (?, 'venda', ?, ?, ?, ?, ?, ?)`,
        [vendaId, proposta.cliente_id, i + 1, numeroParcelas, descricao, valor, vencimento.toISOString().slice(0, 10)],
      )
    }

    await conn.commit()
    res.json({ ok: true, venda_id: vendaId, parcelas: numeroParcelas })
  } catch {
    await conn.rollback()
    res.status(500).json({ erro: 'Erro ao converter proposta.' })
  } finally {
    conn.release()
  }
})

// ------------------------------------------------------------------
// POST /:id/email — envia proposta por e-mail ao cliente
// ------------------------------------------------------------------
propostasRouter.post('/:id/email', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*,
              c.razao_social AS cliente_nome,
              c.nome_fantasia AS cliente_fantasia,
              c.cnpj_cpf AS cliente_cnpj_cpf,
              c.endereco AS cliente_endereco,
              c.cidade AS cliente_cidade,
              c.uf AS cliente_uf,
              c.cep AS cliente_cep,
              c.telefone AS cliente_telefone,
              c.email AS cliente_email,
              u.nome AS vendedor_nome,
              u.email AS vendedor_email
       FROM propostas p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = p.vendedor_id
       WHERE p.id = ?`,
      [req.params.id],
    )
    const p = (rows as any[])[0]
    if (!p) return res.status(404).json({ erro: 'Proposta não encontrada.' })

    const [itens] = await pool.query(
      `SELECT pi.*, prod.modelo AS produto_modelo
       FROM proposta_itens pi
       LEFT JOIN produtos prod ON prod.id = pi.produto_id
       WHERE pi.proposta_id = ? ORDER BY pi.id ASC`,
      [req.params.id],
    )
    p.itens = itens

    const [setupRows] = await pool.query('SELECT * FROM setup WHERE id = 1')
    const setup = (setupRows as any[])[0] ?? {}
    const logoBase64: string | null = setup.logo_base64 ?? null

    const { para, assunto, mensagem } = req.body

    const destinatario = para || p.cliente_email
    if (!destinatario) return res.status(400).json({ erro: 'Cliente não tem e-mail cadastrado.' })

    const assuntoFinal = assunto?.trim() || `Proposta Comercial #${p.id} — ${setup.empresa_nome ?? 'Videomart Broadcast'}`

    const html = `
      <p>${mensagem ? mensagem.replace(/\n/g, '<br>') : `Olá, segue em anexo a proposta comercial <strong>#${p.id}</strong>.`}</p>
      <br>
      <p>Atenciosamente,<br>
      <strong>${p.vendedor_nome}</strong><br>
      ${setup.empresa_nome ?? 'Videomart Broadcast'}
      ${setup.empresa_telefone ? '<br>' + setup.empresa_telefone : ''}
      </p>
    `

    const htmlProposta = gerarHtmlProposta(p, setup, logoBase64)
    const pdfBuffer = await gerarPdfProposta(htmlProposta)

    await enviarEmail({
      to: destinatario,
      subject: assuntoFinal,
      html,
      replyTo: p.vendedor_email || undefined,
      attachments: [{ filename: `proposta-${p.id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    })

    res.json({ ok: true, enviado_para: destinatario })
  } catch (e: any) {
    res.status(500).json({ erro: e.message ?? 'Erro ao enviar e-mail.' })
  }
})
