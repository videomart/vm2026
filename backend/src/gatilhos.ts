import { pool } from './db.js'
import { enviarEmail } from './email.js'
import { gerarContasSaasDoMes } from './routes/contasReceber.js'

// Data de corte para o lembrete de proposta parada: só considera propostas CRIADAS
// a partir do lançamento dessa funcionalidade. Sem isso, o primeiro disparo varreria
// milhares de propostas antigas (importadas do vm2025) já paradas há meses, mandando
// uma avalanche de e-mails de uma vez só — e possivelmente disparando ratelimit do SMTP.
const INICIO_VIGENCIA_LEMBRETE = '2026-06-19'

async function emailsAdmins(): Promise<string[]> {
  const [rows] = await pool.query(
    `SELECT email FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND email IS NOT NULL AND email != ''`,
  ) as any[]
  return rows.map((r: any) => r.email)
}

async function jaNotificadoHoje(tipo: string, entidadeId: number): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM gatilhos_enviados WHERE tipo = ? AND entidade_id = ? AND DATE(enviado_em) = CURDATE() LIMIT 1`,
    [tipo, entidadeId],
  ) as any[]
  return rows.length > 0
}

async function jaNotificadoNosUltimosDias(tipo: string, entidadeId: number, dias: number): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM gatilhos_enviados WHERE tipo = ? AND entidade_id = ? AND enviado_em >= DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 1`,
    [tipo, entidadeId, dias],
  ) as any[]
  return rows.length > 0
}

async function registrarEnvio(tipo: string, entidadeId: number, destinatarios: string[]) {
  await pool.query(
    `INSERT INTO gatilhos_enviados (tipo, entidade_id, destinatarios) VALUES (?, ?, ?)`,
    [tipo, entidadeId, destinatarios.join(', ')],
  )
}

async function getSetup() {
  const [rows] = await pool.query('SELECT * FROM setup WHERE id = 1') as any[]
  return rows[0] ?? {}
}

// (a) Lead sem contato: leads 'novo'/'em_contato' sem atualização há N horas
// (Configurações > Setup, padrão 24). Sem vendedor designado → só admins.
export async function verificarLeadsSemContato() {
  try {
    const setup = await getSetup()
    const horas = Number(setup.lead_sem_contato_horas ?? 24)
    if (horas <= 0) return

    const [leads] = await pool.query(
      `SELECT l.id, l.nome_empresa, l.contato, l.criado_em, l.vendedor_id, u.nome AS vendedor_nome, u.email AS vendedor_email
       FROM leads l
       LEFT JOIN usuarios u ON u.id = l.vendedor_id
       WHERE l.status IN ('novo', 'em_contato')
         AND l.atualizado_em < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [horas],
    ) as any[]

    const admins = await emailsAdmins()

    for (const lead of leads) {
      try {
        if (await jaNotificadoHoje('lead_sem_contato', lead.id)) continue

        const horasParado = Math.floor((Date.now() - new Date(lead.criado_em).getTime()) / 3600000)
        const destinatarios = [lead.vendedor_email, ...admins].filter(Boolean) as string[]
        if (!destinatarios.length) continue

        await enviarEmail({
          to: destinatarios,
          subject: `Lead sem contato há ${horasParado}h — ${lead.nome_empresa ?? lead.contato ?? `#${lead.id}`}`,
          html: `
            <p>O lead <strong>${lead.nome_empresa ?? lead.contato ?? `#${lead.id}`}</strong>
               está sem atualização de status há <strong>${horasParado} horas</strong>.</p>
            <p>${lead.vendedor_nome ? `Vendedor responsável: ${lead.vendedor_nome}.` : 'Este lead ainda não tem vendedor designado.'}</p>
          `,
        })
        await registrarEnvio('lead_sem_contato', lead.id, destinatarios)
      } catch (e) {
        console.error(`Erro ao notificar lead sem contato #${lead.id}:`, e)
      }
    }
  } catch (e) {
    console.error('Erro ao verificar leads sem contato:', e)
  }
}

// (b) Proposta parada: 'aberta' sem atividade há N dias (Configurações > Setup,
// padrão 3). Repete a cada N dias enquanto continuar parada. Movida de email.ts —
// agora também notifica admins, além do vendedor.
export async function verificarPropostasParadas() {
  try {
    const setup = await getSetup()
    const dias = Number(setup.lembrete_proposta_dias ?? 3)
    if (dias <= 0) return

    const [propostas] = await pool.query(
      `SELECT p.id, p.atualizado_em, p.total,
              c.razao_social AS cliente_nome,
              u.nome AS vendedor_nome, u.email AS vendedor_email
       FROM propostas p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = p.vendedor_id
       WHERE p.status = 'aberta'
         AND p.criado_em >= ?
         AND p.atualizado_em < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [INICIO_VIGENCIA_LEMBRETE, dias],
    ) as any[]

    const admins = await emailsAdmins()

    for (const p of propostas) {
      try {
        if (await jaNotificadoNosUltimosDias('proposta_parada', p.id, dias)) continue

        const diasParada = Math.floor((Date.now() - new Date(p.atualizado_em).getTime()) / 86400000)
        const destinatarios = [p.vendedor_email, ...admins].filter(Boolean) as string[]
        if (!destinatarios.length) continue

        await enviarEmail({
          to: destinatarios,
          subject: `Proposta #${p.id} sem retorno há ${diasParada} dias — ${p.cliente_nome}`,
          html: `
            <p>A proposta <strong>#${p.id}</strong> para <strong>${p.cliente_nome}</strong>
               (total: ${Number(p.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
               está sem atividade há <strong>${diasParada} dias</strong>.</p>
            <p>Vendedor responsável: ${p.vendedor_nome}.</p>
            <p>Vale a pena entrar em contato com o cliente para saber se a proposta ainda é
               de interesse, ou marcá-la como recusada se não for mais.</p>
          `,
        })
        await registrarEnvio('proposta_parada', p.id, destinatarios)
      } catch (e) {
        console.error(`Erro ao enviar lembrete da proposta ${p.id}:`, e)
      }
    }
  } catch (e) {
    console.error('Erro ao verificar propostas paradas:', e)
  }
}

// (c) Parcela de conta a receber vencendo (dentro da janela de aviso) ou já vencida.
// Vendedor via venda→usuário quando existir; senão só admins (contas de assinatura/
// manuais não têm vendedor associável). Vencidas repetem o aviso a cada N dias.
export async function verificarParcelasVencimento() {
  try {
    const setup = await getSetup()
    const diasAviso = Number(setup.parcela_vencimento_dias_aviso ?? 3)

    const [contas] = await pool.query(
      `SELECT cr.id, cr.descricao, cr.valor, cr.vencimento, cr.status, cr.moeda,
              cr.cliente_id, c.razao_social AS cliente_nome,
              u.nome AS vendedor_nome, u.email AS vendedor_email
       FROM contas_a_receber cr
       LEFT JOIN clientes c ON c.id = cr.cliente_id
       LEFT JOIN vendas v ON v.id = cr.venda_id
       LEFT JOIN usuarios u ON u.id = v.vendedor_id
       WHERE cr.status IN ('pendente', 'atrasado')
         AND cr.vencimento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
      [diasAviso],
    ) as any[]

    const admins = await emailsAdmins()

    for (const conta of contas) {
      try {
        const vencida = new Date(conta.vencimento) < new Date(new Date().toDateString())
        // Vencidas repetem a cada `diasAviso` dias; a vencer só avisa uma vez.
        const jaNotificado = vencida
          ? await jaNotificadoNosUltimosDias('parcela_vencimento', conta.id, diasAviso)
          : await jaNotificadoHoje('parcela_vencimento', conta.id)
        if (jaNotificado) continue

        const destinatarios = [conta.vendedor_email, ...admins].filter(Boolean) as string[]
        if (!destinatarios.length) continue

        const valorFormatado = Number(conta.valor).toLocaleString('pt-BR', { style: 'currency', currency: conta.moeda || 'BRL' })
        const dataFormatada = new Date(conta.vencimento).toLocaleDateString('pt-BR')

        await enviarEmail({
          to: destinatarios,
          subject: vencida
            ? `Parcela vencida — ${conta.cliente_nome ?? conta.descricao} (${valorFormatado})`
            : `Parcela vencendo em ${dataFormatada} — ${conta.cliente_nome ?? conta.descricao} (${valorFormatado})`,
          html: `
            <p>A conta <strong>${conta.descricao ?? `#${conta.id}`}</strong>
               ${conta.cliente_nome ? `de <strong>${conta.cliente_nome}</strong>` : ''}
               no valor de <strong>${valorFormatado}</strong>
               ${vencida ? 'está <strong>vencida</strong> desde' : 'vence em'} <strong>${dataFormatada}</strong>.</p>
          `,
        })
        await registrarEnvio('parcela_vencimento', conta.id, destinatarios)
      } catch (e) {
        console.error(`Erro ao notificar parcela #${conta.id}:`, e)
      }
    }
  } catch (e) {
    console.error('Erro ao verificar parcelas de vencimento:', e)
  }
}

// (d) Cobrança SaaS não gerada: assinatura ativa sem conta no mês corrente, faltando
// poucos dias para o dia_vencimento — sinaliza falha do gerador automático (cron não
// rodou, erro de SQL). Só admins (assinaturas não têm vendedor associável no schema).
export async function verificarSaasNaoGerada() {
  try {
    const setup = await getSetup()
    const diasAviso = Number(setup.saas_geracao_dias_aviso ?? 5)

    const [assinaturas] = await pool.query(
      `SELECT a.id, a.descricao, a.dia_vencimento, c.razao_social AS cliente_nome
       FROM assinaturas a
       JOIN clientes c ON c.id = a.cliente_id
       WHERE a.status = 'ativa'
         AND a.data_inicio <= CURDATE()
         AND (a.data_fim IS NULL OR a.data_fim >= CURDATE())
         AND NOT EXISTS (
           SELECT 1 FROM contas_a_receber cr
           WHERE cr.assinatura_id = a.id
             AND YEAR(cr.vencimento) = YEAR(CURDATE()) AND MONTH(cr.vencimento) = MONTH(CURDATE())
         )
         AND DAY(CURDATE()) >= LEAST(a.dia_vencimento, 28) - ?`,
      [diasAviso],
    ) as any[]

    if (!assinaturas.length) return
    const admins = await emailsAdmins()
    if (!admins.length) return

    for (const assinatura of assinaturas) {
      try {
        if (await jaNotificadoHoje('saas_nao_gerada', assinatura.id)) continue

        await enviarEmail({
          to: admins,
          subject: `Cobrança SaaS não gerada — ${assinatura.cliente_nome} (${assinatura.descricao})`,
          html: `
            <p>A assinatura <strong>${assinatura.descricao}</strong> de <strong>${assinatura.cliente_nome}</strong>
               ainda não tem cobrança gerada para o mês corrente, e o vencimento (dia
               ${assinatura.dia_vencimento}) está próximo.</p>
            <p>Verifique se o gerador automático de cobranças SaaS está rodando corretamente.</p>
          `,
        })
        await registrarEnvio('saas_nao_gerada', assinatura.id, admins)
      } catch (e) {
        console.error(`Erro ao notificar assinatura sem cobrança #${assinatura.id}:`, e)
      }
    }
  } catch (e) {
    console.error('Erro ao verificar cobranças SaaS não geradas:', e)
  }
}

// Orquestrador chamado uma vez por dia (ver backend/src/index.ts). Cada checagem é
// independente — uma falhar não impede as demais. Roda a geração automática de
// cobrança SaaS antes da checagem (d), para não alertar sobre algo que o próprio
// cron resolveria no mesmo ciclo.
export async function executarGatilhosDiarios() {
  try {
    await gerarContasSaasDoMes()
  } catch (e) {
    console.error('Erro ao gerar contas SaaS do mês:', e)
  }
  await verificarLeadsSemContato()
  await verificarPropostasParadas()
  await verificarParcelasVencimento()
  await verificarSaasNaoGerada()
}
