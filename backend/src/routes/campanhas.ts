import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { requireAdmin } from '../auth/middleware.js'
import { processarCampanhaEmBackground } from '../email.js'

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

// Aceita, por linha, "Nome <email@x.com>" (com nome) ou apenas "email@x.com" (sem
// nome) — e também o uso antigo de colar vários e-mails soltos numa linha só,
// separados por vírgula/espaço, nesse caso sem nome.
function extrairNomeEEmails(texto: string): Map<string, string | null> {
  const regexComNome = /^\s*(.*?)\s*<\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*>\s*$/
  const regexEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const resultado = new Map<string, string | null>()

  for (const linha of texto.split('\n')) {
    const comNome = linha.match(regexComNome)
    if (comNome) {
      const email = comNome[2].toLowerCase().trim()
      const nome = comNome[1].trim() || null
      resultado.set(email, nome)
      continue
    }
    for (const email of linha.match(regexEmail) ?? []) {
      const chave = email.toLowerCase().trim()
      if (!resultado.has(chave)) resultado.set(chave, null)
    }
  }
  return resultado
}

campanhasRouter.post('/grupos/:id/emails-extra', requireAdmin, async (req, res) => {
  try {
    const { texto } = req.body as { texto: string }
    if (!texto?.trim()) return res.status(400).json({ erro: 'Informe ao menos um e-mail.' })

    const encontrados = extrairNomeEEmails(texto)
    if (!encontrados.size) return res.status(400).json({ erro: 'Nenhum e-mail válido encontrado no texto.' })

    const valores = [...encontrados.entries()].map(([email, nome]) => [Number(req.params.id), email, nome])
    await pool.query(
      'INSERT INTO grupo_emails_extra (grupo_id, email, nome) VALUES ? ON DUPLICATE KEY UPDATE nome = COALESCE(VALUES(nome), nome)',
      [valores],
    )

    const [rows] = await pool.query(
      'SELECT id, email, nome FROM grupo_emails_extra WHERE grupo_id = ? ORDER BY email ASC',
      [req.params.id],
    )

    res.json({ ok: true, total_encontrados: encontrados.size, emailsExtra: rows })
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

// Busca clientes que compraram (proposta_itens.descricao/produto) ou demonstraram
// interesse (leads.assunto/mensagem, casado por e-mail) num produto/marca/palavra-chave.
campanhasRouter.get('/clientes-por-interesse', async (req, res) => {
  try {
    const termo = String(req.query.q ?? '').trim()
    if (!termo) return res.status(400).json({ erro: 'Informe um termo de busca (ex.: TVPLAY, VIDEOMART).' })
    const like = `%${termo}%`

    const [compradores] = await pool.query(`
      SELECT DISTINCT c.id, c.razao_social AS nome, c.email, 'compra' AS origem
      FROM clientes c
      JOIN propostas p ON p.cliente_id = c.id
      JOIN proposta_itens pi ON pi.proposta_id = p.id
      LEFT JOIN produtos prod ON prod.id = pi.produto_id
      WHERE c.ativo = 1 AND c.email IS NOT NULL AND c.email != ''
        AND (pi.descricao LIKE ? OR prod.marca LIKE ? OR prod.modelo LIKE ?)
    `, [like, like, like]) as any[][]

    const [interessados] = await pool.query(`
      SELECT DISTINCT c.id, c.razao_social AS nome, c.email, 'lead' AS origem
      FROM clientes c
      JOIN leads l ON l.email = c.email
      WHERE c.ativo = 1 AND c.email IS NOT NULL AND c.email != ''
        AND (l.assunto LIKE ? OR l.mensagem LIKE ?)
    `, [like, like]) as any[][]

    const mapa = new Map<number, any>()
    for (const c of [...(compradores as any[]), ...(interessados as any[])]) {
      const existente = mapa.get(c.id)
      if (existente) {
        if (!existente.origens.includes(c.origem)) existente.origens.push(c.origem)
      } else {
        mapa.set(c.id, { id: c.id, nome: c.nome, email: c.email, origens: [c.origem] })
      }
    }

    res.json({ clientes: [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar clientes por interesse.' })
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
             u.nome AS enviado_por_nome,
             c.status_processamento, c.total_destinatarios,
             (SELECT COUNT(*) FROM campanha_envios ce WHERE ce.campanha_id = c.id AND ce.status = 'enviado') AS total_enviados,
             (SELECT COUNT(*) FROM campanha_envios ce WHERE ce.campanha_id = c.id AND ce.status = 'erro') AS total_erros
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
             c.status_processamento, c.total_destinatarios,
             g.nome AS grupo_nome
      FROM campanhas_email c
      JOIN grupos_envio g ON g.id = c.grupo_id
      WHERE c.id = ?
    `, [req.params.id])
    const campanha = (rows as any[])[0]
    if (!campanha) return res.status(404).json({ erro: 'Campanha não encontrada.' })

    const [envios] = await pool.query(
      `SELECT id, email, nome, status, mensagem_erro, enviado_em
       FROM campanha_envios WHERE campanha_id = ? ORDER BY status DESC, email ASC`,
      [req.params.id],
    )

    res.json({ campanha, envios })
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

// Detecta se a mensagem de erro do SMTP indica que o endereço é definitivamente
// inválido (não existe, domínio inexistente, rejeitado permanentemente) — diferente
// de erros temporários (ratelimit, caixa cheia, timeout de conexão, greylisting),
// que não significam que o e-mail esteja errado e não devem disparar sanitização.
// Códigos SMTP 5xx = erro permanente; 4xx = temporário (RFC 5321). Mensagens sem
// código numérico (timeout, ECONNREFUSED etc.) também são tratadas como temporárias.
function isErroDefinitivo(mensagem: string | null): boolean {
  if (!mensagem) return false
  // Erros de configuração do REMETENTE (não do destinatário) nunca devem disparar
  // sanitização — ex.: "Sender address rejected: not owned by user X" é problema de
  // configuração da conta SMTP usada para enviar, não do e-mail do destinatário.
  if (/sender address rejected|not owned by user/i.test(mensagem)) return false
  if (/\b5\d{2}\s+5\.\d\.\d\b/.test(mensagem)) return true // ex.: "550 5.1.1"
  if (/\b5\d{2}\b/.test(mensagem) && /user unknown|does not exist|no such user|invalid recipient|recipient address rejected|mailbox unavailable|unrouteable/i.test(mensagem)) return true
  return false
}

campanhasRouter.get('/:id/erros-definitivos', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, nome, mensagem_erro FROM campanha_envios WHERE campanha_id = ? AND status = 'erro'`,
      [req.params.id],
    ) as any[]
    const definitivos = (rows as any[]).filter((r) => isErroDefinitivo(r.mensagem_erro))
    res.json({ erros: definitivos })
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar erros da campanha.' })
  }
})

// "Sanitizar": para os e-mails com erro definitivo desta campanha —
//   1. remove o e-mail (avulso) do grupo, se ele veio de grupo_emails_extra
//   2. esvazia clientes.email / contatos.email em todo registro que usa esse
//      endereço e marca email_invalido=1, para parar de tentar enviar e permitir
//      listar quem precisa ter o e-mail recadastrado
campanhasRouter.post('/:id/sanitizar', requireAdmin, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.query(
      `SELECT id, email, mensagem_erro FROM campanha_envios WHERE campanha_id = ? AND status = 'erro'`,
      [req.params.id],
    ) as any[]
    const definitivos = (rows as any[]).filter((r) => isErroDefinitivo(r.mensagem_erro))
    if (!definitivos.length) {
      return res.status(400).json({ erro: 'Nenhum e-mail com erro definitivo para sanitizar.' })
    }

    const [campanhaRows] = await conn.query(
      'SELECT grupo_id FROM campanhas_email WHERE id = ?',
      [req.params.id],
    ) as any[]
    const grupoId = campanhaRows[0]?.grupo_id

    await conn.beginTransaction()

    let clientesAtualizados = 0
    let contatosAtualizados = 0
    let removidosDoGrupo = 0

    for (const { email } of definitivos) {
      const [rCli] = await conn.query(
        `UPDATE clientes SET email = NULL, email_invalido = 1 WHERE email = ?`,
        [email],
      ) as any[]
      clientesAtualizados += (rCli as any).affectedRows

      const [rCont] = await conn.query(
        `UPDATE contatos SET email = NULL, email_invalido = 1 WHERE email = ?`,
        [email],
      ) as any[]
      contatosAtualizados += (rCont as any).affectedRows

      if (grupoId) {
        const [rGrupo] = await conn.query(
          `DELETE FROM grupo_emails_extra WHERE grupo_id = ? AND email = ?`,
          [grupoId, email],
        ) as any[]
        removidosDoGrupo += (rGrupo as any).affectedRows
      }
    }

    await conn.commit()
    res.json({
      ok: true,
      total_sanitizados: definitivos.length,
      clientes_atualizados: clientesAtualizados,
      contatos_atualizados: contatosAtualizados,
      removidos_do_grupo: removidosDoGrupo,
    })
  } catch {
    await conn.rollback()
    res.status(500).json({ erro: 'Erro ao sanitizar e-mails.' })
  } finally {
    conn.release()
  }
})

// Sanitização manual: recebe uma lista de e-mails (importada de fora do sistema,
// ex.: relatório de bounce de outra ferramenta) e aplica o mesmo tratamento do
// /:id/sanitizar — esvazia clientes.email/contatos.email e marca email_invalido=1,
// removendo o endereço de qualquer grupo de envio onde apareça avulso. Não depende
// de uma campanha específica, por isso fica fora do prefixo /:id.
campanhasRouter.post('/sanitizar-lista', requireAdmin, async (req, res) => {
  const emailsBrutos = Array.isArray(req.body?.emails) ? req.body.emails : []
  const emails = [...new Set(
    emailsBrutos
      .map((e: unknown) => String(e ?? '').trim().toLowerCase())
      .filter((e: string) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
  )] as string[]

  if (!emails.length) {
    return res.status(400).json({ erro: 'Nenhum e-mail válido encontrado na lista.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    let clientesAtualizados = 0
    let contatosAtualizados = 0
    let removidosDeGrupos = 0

    for (const email of emails) {
      const [rCli] = await conn.query(
        `UPDATE clientes SET email = NULL, email_invalido = 1 WHERE email = ?`,
        [email],
      ) as any[]
      clientesAtualizados += (rCli as any).affectedRows

      const [rCont] = await conn.query(
        `UPDATE contatos SET email = NULL, email_invalido = 1 WHERE email = ?`,
        [email],
      ) as any[]
      contatosAtualizados += (rCont as any).affectedRows

      const [rGrupo] = await conn.query(
        `DELETE FROM grupo_emails_extra WHERE email = ?`,
        [email],
      ) as any[]
      removidosDeGrupos += (rGrupo as any).affectedRows
    }

    await conn.commit()
    res.json({
      ok: true,
      total_processados: emails.length,
      clientes_atualizados: clientesAtualizados,
      contatos_atualizados: contatosAtualizados,
      removidos_de_grupos: removidosDeGrupos,
    })
  } catch {
    await conn.rollback()
    res.status(500).json({ erro: 'Erro ao sanitizar lista de e-mails.' })
  } finally {
    conn.release()
  }
})

// Retoma uma campanha travada (ex.: backend reiniciou no meio do processamento).
// Reprocessa quem está 'pendente'; se reincluir_erros=true, também tenta de novo
// quem falhou antes (útil quando o erro era ratelimit/conta sem saldo, já corrigido).
campanhasRouter.post('/:id/retomar', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, assunto, corpo, status_processamento FROM campanhas_email WHERE id = ?',
      [req.params.id],
    ) as any[]
    const campanha = rows[0]
    if (!campanha) return res.status(404).json({ erro: 'Campanha não encontrada.' })

    if (req.body?.reincluir_erros) {
      await pool.query(
        `UPDATE campanha_envios SET status = 'pendente', mensagem_erro = NULL WHERE campanha_id = ? AND status = 'erro'`,
        [req.params.id],
      )
    }

    const [pendentesRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM campanha_envios WHERE campanha_id = ? AND status = 'pendente'`,
      [req.params.id],
    ) as any[]
    if (!pendentesRows[0].total) return res.status(400).json({ erro: 'Nenhum destinatário pendente para reenviar.' })

    await pool.query(
      `UPDATE campanhas_email SET status_processamento = 'processando' WHERE id = ?`,
      [req.params.id],
    )

    processarCampanhaEmBackground(campanha.id, campanha.assunto, campanha.corpo)
      .catch((e) => console.error(`Erro ao retomar campanha ${campanha.id} em background:`, e))

    res.json({ ok: true, pendentes: pendentesRows[0].total })
  } catch {
    res.status(500).json({ erro: 'Erro ao retomar campanha.' })
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
      `INSERT INTO campanhas_email (grupo_id, assunto, corpo, enviado_por, status_processamento, total_destinatarios)
       VALUES (?, ?, ?, ?, 'processando', ?)`,
      [grupo_id, assunto.trim(), corpo.trim(), req.usuario.id, clientes.length],
    ) as any[]
    const campanhaId = r.insertId

    // Cria um registro de envio por destinatário (status pendente) — é o que permite
    // acompanhar progresso e ver exatamente quais e-mails falharam depois.
    const valoresEnvios = clientes.map((c: any) => [campanhaId, c.email, c.nome ?? null])
    await pool.query(
      'INSERT INTO campanha_envios (campanha_id, email, nome) VALUES ?',
      [valoresEnvios],
    )

    // Dispara o processamento em background — não prende a requisição HTTP esperando
    // todos os e-mails serem enviados (com 451 destinatários e limite/hora, isso podia
    // levar horas e a conexão expirava antes, sem nenhum log do que tinha acontecido).
    processarCampanhaEmBackground(campanhaId, assunto.trim(), corpo.trim())
      .catch((e) => console.error(`Erro ao processar campanha ${campanhaId} em background:`, e))

    res.json({
      ok: true,
      campanhaId,
      total: clientes.length,
      processando: true,
    })
  } catch {
    res.status(500).json({ erro: 'Erro ao iniciar disparo da campanha.' })
  }
})
