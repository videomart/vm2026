import nodemailer from 'nodemailer'
import juice from 'juice'
import { pool } from './db.js'

// Clientes de e-mail (Gmail, Outlook etc.) ignoram <style> em <head> por segurança —
// só respeitam CSS já inline em cada elemento. juice converte um pelo outro antes do envio.
function inlinarCss(html: string | undefined): string | undefined {
  if (!html) return html
  try {
    return juice(html)
  } catch {
    return html
  }
}

type ContaSmtp = {
  id: number
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  replyTo: string | null
  limiteDia: number
}

// Retorna config SMTP única (setup): usada no envio individual (proposta por e-mail),
// que não precisa de rotação de caixas — prioriza setup do banco, cai para .env.
async function getSmtpConfig() {
  try {
    const [rows] = await pool.query('SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, smtp_limite_hora FROM setup WHERE id = 1')
    const s = (rows as any[])[0]
    if (s?.smtp_host && s?.smtp_user) {
      return {
        host: s.smtp_host as string,
        port: Number(s.smtp_port ?? 587),
        secure: Boolean(s.smtp_secure),
        user: s.smtp_user as string,
        pass: s.smtp_pass as string,
        from: (s.smtp_from ?? s.smtp_user) as string,
        limiteHora: Number(s.smtp_limite_hora ?? 100),
      }
    }
  } catch { /* fallback para env */ }

  return {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '',
    limiteHora: 100,
  }
}

// Lista as contas SMTP ativas com saldo disponível hoje (limite_dia - já enviado hoje),
// usadas para distribuir campanhas grandes em round-robin entre múltiplas caixas
// (Hostinger limita ~100 e-mails/dia por caixa postal).
async function contasComSaldoHoje(): Promise<ContaSmtp[]> {
  const [rows] = await pool.query(`
    SELECT cs.id, cs.host, cs.port, cs.secure, cs.smtp_user, cs.smtp_pass, cs.smtp_from, cs.reply_to,
           cs.limite_dia, COALESCE(u.total_enviado, 0) AS usado_hoje
    FROM contas_smtp cs
    LEFT JOIN contas_smtp_uso u ON u.conta_id = cs.id AND u.data = CURDATE()
    WHERE cs.ativo = 1
    HAVING usado_hoje < cs.limite_dia
    ORDER BY usado_hoje ASC, cs.id ASC
  `) as any[]

  return (rows as any[]).map((r) => ({
    id: r.id,
    host: r.host,
    port: Number(r.port),
    secure: Boolean(r.secure),
    user: r.smtp_user,
    pass: r.smtp_pass,
    from: r.smtp_from ?? r.smtp_user,
    replyTo: r.reply_to ?? null,
    limiteDia: r.limite_dia - r.usado_hoje, // saldo restante hoje
  }))
}

async function registrarUsoConta(contaId: number) {
  await pool.query(
    `INSERT INTO contas_smtp_uso (conta_id, data, total_enviado) VALUES (?, CURDATE(), 1)
     ON DUPLICATE KEY UPDATE total_enviado = total_enviado + 1`,
    [contaId],
  )
}

export async function enviarEmail(opts: {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  replyTo?: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}) {
  const cfg = await getSmtpConfig()
  const t = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  })
  return t.sendMail({
    from: cfg.from,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    text: opts.text,
    html: inlinarCss(opts.html),
    replyTo: opts.replyTo,
    attachments: opts.attachments,
  })
}

// Processa uma campanha em background, distribuindo os destinatários em round-robin
// entre as contas SMTP cadastradas com saldo diário disponível. Grava o resultado de
// cada destinatário em campanha_envios (status pendente/enviado/erro) — permite
// acompanhar progresso e identificar exatamente quais e-mails falharam, sem prender
// a requisição HTTP. Se ficar sem saldo em todas as contas, marca os restantes como
// 'erro' (limite diário esgotado) em vez de ficar tentando indefinidamente.
export async function processarCampanhaEmBackground(campanhaId: number, assunto: string, html: string) {
  const htmlInline = inlinarCss(html)

  try {
    const [pendentes] = await pool.query(
      'SELECT id, email FROM campanha_envios WHERE campanha_id = ? AND status = ?',
      [campanhaId, 'pendente'],
    ) as any[]

    let contas = await contasComSaldoHoje()

    // Sem contas cadastradas: cai para o SMTP único configurado em Setup (compatibilidade
    // com instalações que ainda não migraram para múltiplas caixas)
    if (!contas.length) {
      const cfgUnico = await getSmtpConfig()
      if (cfgUnico.host && cfgUnico.user) {
        contas = [{
          id: 0,
          host: cfgUnico.host, port: cfgUnico.port, secure: cfgUnico.secure,
          user: cfgUnico.user, pass: cfgUnico.pass, from: cfgUnico.from,
          replyTo: null, limiteDia: Infinity,
        }]
      }
    }

    if (!contas.length) {
      await pool.query(
        `UPDATE campanha_envios SET status = 'erro', mensagem_erro = 'Nenhuma conta SMTP configurada.' WHERE campanha_id = ? AND status = 'pendente'`,
        [campanhaId],
      )
      await pool.query(`UPDATE campanhas_email SET status_processamento = 'erro' WHERE id = ?`, [campanhaId])
      return
    }

    const transportes = new Map(contas.map((c) => [c.id, nodemailer.createTransport({
      host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    })]))

    // Espaçamento entre envios, mesmo distribuindo entre contas. Valor conservador para
    // não disparar a proteção antispam de provedores (Hostinger já suspendeu as contas
    // por "atividade suspeita" com envio de volume simultâneo entre múltiplas caixas
    // novas) — aumentar com cautela, e só depois de um período de aquecimento.
    const intervaloMs = 10000
    let indiceConta = 0
    let processados = 0

    for (const dest of pendentes as any[]) {
      // pula contas que já esgotaram o saldo do dia
      let tentativas = 0
      while (contas[indiceConta]?.limiteDia <= 0 && tentativas < contas.length) {
        indiceConta = (indiceConta + 1) % contas.length
        tentativas++
      }

      const conta = contas[indiceConta]
      if (!conta || conta.limiteDia <= 0) {
        await pool.query(
          `UPDATE campanha_envios SET status = 'erro', mensagem_erro = 'Limite diário de envio esgotado em todas as contas SMTP.' WHERE id = ?`,
          [dest.id],
        )
        continue
      }

      try {
        const t = transportes.get(conta.id)!
        await t.sendMail({
          from: conta.from,
          to: dest.email,
          subject: assunto,
          html: htmlInline,
          replyTo: conta.replyTo ?? undefined,
        })
        await pool.query(
          `UPDATE campanha_envios SET status = 'enviado', enviado_em = NOW(), conta_smtp_id = ? WHERE id = ?`,
          [conta.id || null, dest.id],
        )
        if (conta.id) await registrarUsoConta(conta.id)
        conta.limiteDia--
      } catch (e: any) {
        await pool.query(
          `UPDATE campanha_envios SET status = 'erro', mensagem_erro = ?, conta_smtp_id = ? WHERE id = ?`,
          [String(e.message ?? e).slice(0, 500), conta.id || null, dest.id],
        )
      }

      indiceConta = (indiceConta + 1) % contas.length
      processados++
      if (processados < pendentes.length) {
        await new Promise((r) => setTimeout(r, intervaloMs))
      }
    }

    await pool.query(
      `UPDATE campanhas_email SET status_processamento = 'concluida', enviado_em = NOW() WHERE id = ?`,
      [campanhaId],
    )
  } catch {
    await pool.query(
      `UPDATE campanhas_email SET status_processamento = 'erro' WHERE id = ?`,
      [campanhaId],
    )
  }
}

// Ao reiniciar (deploy, crash, restart de container), qualquer campanha que ficou
// presa em "processando" tinha seu envio interrompido sem deixar erro registrado —
// o loop de processarCampanhaEmBackground só existe na memória do processo Node, que
// morre junto com o container. Chamado uma vez na inicialização do backend para
// retomar automaticamente esses envios pendentes, sem depender de alguém notar e
// clicar em "Retomar" manualmente.
export async function retomarCampanhasTravadas() {
  try {
    const [campanhas] = await pool.query(
      `SELECT id, assunto, corpo FROM campanhas_email WHERE status_processamento = 'processando'`,
    ) as any[]

    for (const c of campanhas as any[]) {
      const [pendentesRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM campanha_envios WHERE campanha_id = ? AND status = 'pendente'`,
        [c.id],
      ) as any[]
      if (!pendentesRows[0].total) {
        await pool.query(
          `UPDATE campanhas_email SET status_processamento = 'concluida', enviado_em = NOW() WHERE id = ?`,
          [c.id],
        )
        continue
      }
      console.log(`Retomando campanha ${c.id} travada em "processando" (${pendentesRows[0].total} pendentes)...`)
      processarCampanhaEmBackground(c.id, c.assunto, c.corpo)
        .catch((e) => console.error(`Erro ao retomar campanha ${c.id} automaticamente:`, e))
    }
  } catch (e) {
    console.error('Erro ao verificar campanhas travadas na inicialização:', e)
  }
}
