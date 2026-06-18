import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'
import { enviarCampanha } from '../email.js'

export const campanhasRouter = Router()
campanhasRouter.use(requireAuth)

// ─── Grupos de envio ──────────────────────────────────────────────────────────

campanhasRouter.get('/grupos', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT g.id, g.nome, g.descricao, g.criado_em,
             COUNT(DISTINCT gc.cliente_id) + COUNT(DISTINCT ge.id) AS total_clientes
      FROM grupos_envio g
      LEFT JOIN grupo_clientes gc ON gc.grupo_id = g.id
      LEFT JOIN grupo_emails_extra ge ON ge.grupo_id = g.id
      GROUP BY g.id
      ORDER BY g.nome ASC
    `)
    res.json({ grupos: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar grupos.' })
  }
})

campanhasRouter.get('/grupos/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM grupos_envio WHERE id = ?', [req.params.id])
    const grupo = (rows as any[])[0]
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' })

    const [clientes] = await pool.query(`
      SELECT c.id, c.razao_social AS nome, c.email
      FROM grupo_clientes gc
      JOIN clientes c ON c.id = gc.cliente_id
      WHERE gc.grupo_id = ?
      ORDER BY c.razao_social ASC
    `, [req.params.id])

    const [emailsExtra] = await pool.query(`
      SELECT id, email, nome FROM grupo_emails_extra WHERE grupo_id = ? ORDER BY email ASC
    `, [req.params.id])

    res.json({ grupo, clientes, emailsExtra })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar grupo.' })
  }
})

// E-mails avulsos (importação por texto/arquivo) ───────────────────────────────

campanhasRouter.post('/grupos/:id/emails-extra', requireAdmin, async (req, res) => {
  try {
    const { texto } = req.body as { texto: string }
    if (!texto?.trim()) return res.status(400).json({ erro: 'Informe ao menos um e-mail.' })

    const regexEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const encontrados = texto.match(regexEmail) ?? []
    const unicos = [...new Set(encontrados.map((e) => e.toLowerCase().trim()))]

    if (!unicos.length) return res.status(400).json({ erro: 'Nenhum e-mail válido encontrado no texto.' })

    const valores = unicos.map((email) => [Number(req.params.id), email])
    await pool.query(
      'INSERT IGNORE INTO grupo_emails_extra (grupo_id, email) VALUES ?',
      [valores],
    )

    const [rows] = await pool.query(
      'SELECT id, email, nome FROM grupo_emails_extra WHERE grupo_id = ? ORDER BY email ASC',
      [req.params.id],
    )

    res.json({ ok: true, total_encontrados: unicos.length, emailsExtra: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao importar e-mails.' })
  }
})

campanhasRouter.delete('/grupos/:id/emails-extra/:emailId', requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM grupo_emails_extra WHERE id = ? AND grupo_id = ?',
      [req.params.emailId, req.params.id],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover e-mail.' })
  }
})

campanhasRouter.post('/grupos', requireAdmin, async (req, res) => {
  try {
    const { nome, descricao } = req.body
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    const [r] = await pool.query(
      'INSERT INTO grupos_envio (nome, descricao) VALUES (?, ?)',
      [nome.trim(), descricao?.trim() ?? null],
    ) as any[]
    res.status(201).json({ grupo: { id: r.insertId, nome: nome.trim(), descricao: descricao?.trim() ?? null } })
  } catch {
    res.status(500).json({ erro: 'Erro ao criar grupo.' })
  }
})

campanhasRouter.put('/grupos/:id', requireAdmin, async (req, res) => {
  try {
    const { nome, descricao } = req.body
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório.' })
    await pool.query(
      'UPDATE grupos_envio SET nome = ?, descricao = ? WHERE id = ?',
      [nome.trim(), descricao?.trim() ?? null, req.params.id],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar grupo.' })
  }
})

campanhasRouter.delete('/grupos/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM grupos_envio WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover grupo.' })
  }
})

// Clientes do grupo
campanhasRouter.post('/grupos/:id/clientes', requireAdmin, async (req, res) => {
  try {
    const { cliente_ids } = req.body as { cliente_ids: number[] }
    if (!Array.isArray(cliente_ids) || !cliente_ids.length)
      return res.status(400).json({ erro: 'Informe ao menos um cliente.' })
    const values = cliente_ids.map((cid) => [Number(req.params.id), cid])
    await pool.query(
      'INSERT IGNORE INTO grupo_clientes (grupo_id, cliente_id) VALUES ?',
      [values],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao adicionar clientes.' })
  }
})

campanhasRouter.delete('/grupos/:id/clientes/:cliente_id', requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM grupo_clientes WHERE grupo_id = ? AND cliente_id = ?',
      [req.params.id, req.params.cliente_id],
    )
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover cliente do grupo.' })
  }
})

// ─── Campanhas / Disparos ─────────────────────────────────────────────────────

campanhasRouter.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.assunto, c.enviado_em, c.criado_em,
             c.grupo_id, g.nome AS grupo_nome,
             u.nome AS enviado_por_nome
      FROM campanhas_email c
      JOIN grupos_envio g ON g.id = c.grupo_id
      JOIN usuarios u ON u.id = c.enviado_por
      ORDER BY c.criado_em DESC
      LIMIT 100
    `)
    res.json({ campanhas: rows })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar campanhas.' })
  }
})

campanhasRouter.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.assunto, c.corpo, c.grupo_id, c.enviado_em, c.criado_em,
             g.nome AS grupo_nome
      FROM campanhas_email c
      JOIN grupos_envio g ON g.id = c.grupo_id
      WHERE c.id = ?
    `, [req.params.id])
    const campanha = (rows as any[])[0]
    if (!campanha) return res.status(404).json({ erro: 'Campanha não encontrada.' })
    res.json({ campanha })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar campanha.' })
  }
})

campanhasRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM campanhas_email WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ erro: 'Erro ao remover campanha.' })
  }
})

campanhasRouter.post('/', requireAdmin, async (req: any, res) => {
  try {
    const { grupo_id, assunto, corpo, incluir_contatos } = req.body
    if (!grupo_id || !assunto?.trim() || !corpo?.trim())
      return res.status(400).json({ erro: 'grupo_id, assunto e corpo são obrigatórios.' })

    // Busca clientes do grupo que têm e-mail
    const [clientesRows] = await pool.query(`
      SELECT c.id, c.razao_social AS nome, c.email
      FROM grupo_clientes gc
      JOIN clientes c ON c.id = gc.cliente_id
      WHERE gc.grupo_id = ? AND c.email IS NOT NULL AND c.email != '' AND c.ativo = 1
    `, [grupo_id]) as any[][]

    let clientes = clientesRows as any[]

    if (incluir_contatos) {
      const [idsClientesGrupo] = await pool.query(`
        SELECT c.id, c.razao_social AS nome
        FROM grupo_clientes gc
        JOIN clientes c ON c.id = gc.cliente_id
        WHERE gc.grupo_id = ? AND c.ativo = 1
      `, [grupo_id]) as any[][]

      if ((idsClientesGrupo as any[]).length) {
        const [contatos] = await pool.query(`
          SELECT ct.cliente_id, ct.email
          FROM contatos ct
          WHERE ct.cliente_id IN (?) AND ct.ativo = 1 AND ct.email IS NOT NULL AND ct.email != ''
        `, [(idsClientesGrupo as any[]).map((c) => c.id)]) as any[][]

        const nomePorCliente = new Map((idsClientesGrupo as any[]).map((c) => [c.id, c.nome]))
        const extras = (contatos as any[]).map((ct) => ({
          id: ct.cliente_id,
          nome: nomePorCliente.get(ct.cliente_id),
          email: ct.email,
        }))
        clientes = [...clientes, ...extras]
      }
    }

    // E-mails avulsos importados (texto/arquivo, sem cliente vinculado)
    const [emailsExtra] = await pool.query(
      'SELECT email, nome FROM grupo_emails_extra WHERE grupo_id = ?',
      [grupo_id],
    ) as any[][]
    clientes = [...clientes, ...(emailsExtra as any[]).map((e) => ({ id: null, nome: e.nome ?? e.email, email: e.email }))]

    // remove duplicados por e-mail (case-insensitive)
    const vistos = new Set<string>()
    clientes = clientes.filter((c) => {
      const chave = String(c.email).toLowerCase().trim()
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })

    if (!clientes.length)
      return res.status(400).json({ erro: 'Nenhum destinatário com e-mail neste grupo.' })

    // Registra campanha
    const [r] = await pool.query(
      'INSERT INTO campanhas_email (grupo_id, assunto, corpo, enviado_por) VALUES (?, ?, ?, ?)',
      [grupo_id, assunto.trim(), corpo.trim(), req.usuario.id],
    ) as any[]
    const campanhaId = r.insertId

    // Dispara e-mails respeitando limite/hora configurado no setup
    const { enviados, erros } = await enviarCampanha(
      clientes.map((c: any) => ({ email: c.email, nome: c.nome })),
      assunto.trim(),
      corpo.trim(),
    )

    // Marca como enviado
    await pool.query(
      'UPDATE campanhas_email SET enviado_em = NOW() WHERE id = ?',
      [campanhaId],
    )

    res.json({
      ok: true,
      campanhaId,
      total: enviados,
      erros: erros.length ? erros : undefined,
    })
  } catch {
    res.status(500).json({ erro: 'Erro ao disparar campanha.' })
  }
})
