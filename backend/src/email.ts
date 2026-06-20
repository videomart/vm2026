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

// Retorna a conta SMTP marcada como "padrão" (Configurações > Contas SMTP) —
// usada no envio individual (reset de senha, proposta por e-mail), que não
// precisa de rotação de caixas. Cai para .env só se nenhuma conta padrão
// existir (instalação nova sem nenhuma conta cadastrada ainda).
async function getSmtpConfig() {
  try {
    const [rows] = await pool.query(
      'SELECT host, port, secure, smtp_user, smtp_pass, smtp_from, limite_dia FROM contas_smtp WHERE padrao = 1 AND ativo = 1 LIMIT 1',
    )
    const s = (rows as any[])[0]
    if (s?.host && s?.smtp_user) {
      return {
        host: s.host as string,
        port: Number(s.port ?? 587),
        secure: Boolean(s.secure),
        user: s.smtp_user as string,
        pass: s.smtp_pass as string,
        from: (s.smtp_from ?? s.smtp_user) as string,
        limiteHora: Number(s.limite_dia ?? 100),
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

// Configuração de ritmo de envio (Configurações > Setup) — recomendação do suporte
// da Hostinger após bloqueio por ratelimit ("4.7.1 Ratelimit ... exceeded") em
// campanhas grandes disparadas em sequência contínua. Duas estratégias combinadas:
//   - intervalo: pausa entre CADA e-mail (mín. recomendado pelo suporte: 30-60s)
//   - lote: após enviar N e-mails, pausa mais longa (mín. recomendado: 5-10 min)
//     antes de continuar — simula "distribuir ao longo do dia" sem precisar de
//     intervenção manual.
async function configEnvio() {
  const [rows] = await pool.query(
    'SELECT envio_intervalo_segundos, envio_lote_tamanho, envio_lote_pausa_segundos FROM setup WHERE id = 1',
  ) as any[]
  const s = (rows as any[])[0]
  return {
    intervaloMs: Number(s?.envio_intervalo_segundos ?? 10) * 1000,
    loteTamanho: Number(s?.envio_lote_tamanho ?? 25),
    lotePausaMs: Number(s?.envio_lote_pausa_segundos ?? 300) * 1000,
  }
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

    // Espaçamento entre envios + pausa longa a cada lote — configurável em
    // Configurações > Setup (ver configEnvio). Valores conservadores por padrão para
    // não disparar a proteção antispam de provedores (Hostinger já suspendeu/bloqueou
    // contas por "atividade suspeita"/ratelimit em campanhas grandes em sequência
    // contínua) — aumentar com cautela, e só depois de um período de aquecimento.
    const { intervaloMs, loteTamanho, lotePausaMs } = await configEnvio()
    let indiceConta = 0
    let processados = 0
    let noLoteAtual = 0

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
      noLoteAtual++

      if (processados >= pendentes.length) break

      if (loteTamanho > 0 && noLoteAtual >= loteTamanho) {
        console.log(`Campanha ${campanhaId}: lote de ${loteTamanho} concluído, pausando ${lotePausaMs / 1000}s antes de continuar...`)
        noLoteAtual = 0
        await new Promise((r) => setTimeout(r, lotePausaMs))
      } else {
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

// Data de corte: só considera propostas CRIADAS a partir do lançamento dessa
// funcionalidade. Sem isso, o primeiro disparo varreria milhares de propostas
// antigas (importadas do vm2025) já paradas há meses, mandando uma avalanche de
// e-mails de uma vez só pros vendedores — e possivelmente disparando ratelimit
// do SMTP de novo. Propostas antigas continuam visíveis/editáveis normalmente,
// só não entram nesse lembrete automático.
const INICIO_VIGENCIA_LEMBRETE = '2026-06-19'

// Lembrete de proposta parada: propostas 'aberta' sem nenhuma atividade (edição,
// aprovação, recusa) há N dias (Configurações > Setup, padrão 3) recebem um e-mail
// avisando o vendedor responsável. Repete a cada N dias enquanto continuar parada —
// ultimo_lembrete_em controla isso, para não reenviar todo dia que essa checagem rodar.
export async function verificarPropostasParadas() {
  try {
    const [setupRows] = await pool.query('SELECT lembrete_proposta_dias FROM setup WHERE id = 1') as any[]
    const dias = Number(setupRows[0]?.lembrete_proposta_dias ?? 3)
    if (dias <= 0) return

    const [propostas] = await pool.query(
      `SELECT p.id, p.atualizado_em, p.ultimo_lembrete_em, p.total,
              c.razao_social AS cliente_nome,
              u.nome AS vendedor_nome, u.email AS vendedor_email
       FROM propostas p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = p.vendedor_id
       WHERE p.status = 'aberta'
         AND p.criado_em >= ?
         AND p.atualizado_em < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND (p.ultimo_lembrete_em IS NULL OR p.ultimo_lembrete_em < DATE_SUB(NOW(), INTERVAL ? DAY))
         AND u.email IS NOT NULL AND u.email != ''`,
      [INICIO_VIGENCIA_LEMBRETE, dias, dias],
    ) as any[]

    for (const p of propostas as any[]) {
      try {
        const diasParada = Math.floor((Date.now() - new Date(p.atualizado_em).getTime()) / 86400000)
        await enviarEmail({
          to: p.vendedor_email,
          subject: `Proposta #${p.id} sem retorno há ${diasParada} dias — ${p.cliente_nome}`,
          html: `
            <p>Olá, ${p.vendedor_nome}.</p>
            <p>A proposta <strong>#${p.id}</strong> para <strong>${p.cliente_nome}</strong>
               (total: ${Number(p.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
               está sem atividade há <strong>${diasParada} dias</strong>.</p>
            <p>Vale a pena entrar em contato com o cliente para saber se a proposta ainda é
               de interesse, ou marcá-la como recusada se não for mais.</p>
          `,
        })
        await pool.query('UPDATE propostas SET ultimo_lembrete_em = NOW() WHERE id = ?', [p.id])
        console.log(`Lembrete de proposta #${p.id} parada enviado para ${p.vendedor_email}.`)
      } catch (e) {
        console.error(`Erro ao enviar lembrete da proposta ${p.id}:`, e)
      }
    }
  } catch (e) {
    console.error('Erro ao verificar propostas paradas:', e)
  }
}
