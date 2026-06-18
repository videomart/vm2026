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

// Retorna config SMTP: prioriza setup do banco, cai para process.env como fallback
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

// Para campanhas com respeito ao limite/hora
export async function enviarCampanha(destinatarios: { email: string; nome: string }[], assunto: string, html: string): Promise<{ enviados: number; erros: string[] }> {
  const cfg = await getSmtpConfig()
  const t = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  })
  const htmlInline = inlinarCss(html)

  const erros: string[] = []
  let enviados = 0
  const intervaloMs = cfg.limiteHora > 0 ? Math.ceil(3600000 / cfg.limiteHora) : 0

  for (const dest of destinatarios) {
    try {
      await t.sendMail({
        from: cfg.from,
        to: dest.email,
        subject: assunto,
        html: htmlInline,
      })
      enviados++
      if (intervaloMs > 0 && enviados < destinatarios.length) {
        await new Promise((r) => setTimeout(r, intervaloMs))
      }
    } catch (e: any) {
      erros.push(`${dest.email}: ${e.message}`)
    }
  }

  return { enviados, erros }
}
