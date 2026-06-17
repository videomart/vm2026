import puppeteer from 'puppeteer'

function fmt(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(s: string | Date | null) {
  if (!s) return ''
  const str = s instanceof Date ? s.toISOString() : String(s)
  return str.slice(0, 10).split('-').reverse().join('/')
}

function stripHtml(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export function gerarHtmlProposta(p: any, setup: any, logoBase64?: string | null): string {
  const itens: any[] = p.itens ?? []
  const subtotalItens = itens.reduce((s: number, i: any) => s + Number(i.subtotal), 0)
  const descGlobal = Number(p.desconto) || 0
  const total = Number(p.total) || subtotalItens - descGlobal
  const condicoes = stripHtml(p.condicoes_pagamento)
  const observacoes = stripHtml(p.observacoes)

  const linhasItens = itens.map((item: any, idx: number) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${item.descricao ?? ''}${item.produto_modelo && item.produto_modelo !== item.descricao ? `<div style="font-size:11px;color:#555">${item.produto_modelo}</div>` : ''}</td>
      <td style="text-align:right">${Number(item.quantidade)}</td>
      <td style="text-align:right">${fmt(item.valor_unitario)}</td>
      <td style="text-align:right">${Number(item.desconto) > 0 ? fmt(item.desconto) : '—'}</td>
      <td style="text-align:right">${fmt(item.subtotal)}</td>
    </tr>`).join('')

  const linhasDesconto = descGlobal > 0 ? `
    <tr><td colspan="5" style="text-align:right;border:none">Subtotal</td><td style="text-align:right;border:none">${fmt(subtotalItens)}</td></tr>
    <tr><td colspan="5" style="text-align:right;border:none">Desconto</td><td style="text-align:right;border:none">− ${fmt(descGlobal)}</td></tr>` : ''

  const logoTag = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;display:block;margin-bottom:4px">`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 32px }
  .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px }
  .empresa { line-height: 1.6 }
  .empresa strong { font-size: 15px }
  .titulo-bloco { text-align: right }
  .titulo { font-size: 18px; font-weight: bold; letter-spacing: 1px; margin-bottom: 8px }
  .meta { font-size: 12px; border-collapse: collapse }
  .meta th { text-align: right; padding-right: 8px; font-weight: normal; color: #555 }
  hr { border: none; border-top: 1px solid #ccc; margin: 12px 0 }
  .partes { display: flex; gap: 32px; margin-bottom: 16px }
  .parte { flex: 1; line-height: 1.6 }
  .parte-titulo { font-size: 10px; font-weight: bold; letter-spacing: 1px; color: #888; margin-bottom: 4px }
  table.itens { width: 100%; border-collapse: collapse; margin-bottom: 8px }
  table.itens th { background: #f0f0f0; padding: 6px 8px; text-align: left; border-bottom: 2px solid #ccc; font-size: 11px }
  table.itens td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top }
  .totais { text-align: right; margin-bottom: 16px }
  .total-final { font-size: 14px; font-weight: bold; border-top: 2px solid #222; padding-top: 4px; margin-top: 4px }
  .rodape { margin-top: 16px; font-size: 11px; line-height: 1.7 }
  .rodape strong { display: block; margin-bottom: 2px }
  .rodape .item { margin-bottom: 12px }
  .rodape .item span { white-space: pre-wrap }
  .assinatura { margin-top: 48px; display: flex; justify-content: space-around }
  .assinatura-bloco { text-align: center; min-width: 200px }
  .assinatura-linha { border-top: 1px solid #222; padding-top: 4px; margin-top: 48px }
</style>
</head>
<body>
  <div class="cabecalho">
    <div class="empresa">
      ${logoTag}
      <strong>${setup?.empresa_nome ?? 'Videomart Broadcast'}</strong><br>
      ${setup?.empresa_cnpj ? `CNPJ: ${setup.empresa_cnpj}<br>` : ''}
      ${setup?.empresa_endereco ? `${setup.empresa_endereco}<br>` : ''}
      ${setup?.empresa_telefone ? `Tel: ${setup.empresa_telefone}<br>` : ''}
      ${setup?.empresa_email ? `${setup.empresa_email}<br>` : ''}
    </div>
    <div class="titulo-bloco">
      <div class="titulo">PROPOSTA COMERCIAL</div>
      <table class="meta">
        <tr><th>Nº</th><td>${p.id}</td></tr>
        <tr><th>Data</th><td>${fmtData(p.data)}</td></tr>
        ${p.validade ? `<tr><th>Validade</th><td>${fmtData(p.validade)}</td></tr>` : ''}
      </table>
    </div>
  </div>
  <hr>
  <div class="partes">
    <div class="parte">
      <div class="parte-titulo">CLIENTE</div>
      <strong>${p.cliente_nome ?? ''}</strong><br>
      ${p.cliente_cnpj_cpf ? `CNPJ/CPF: ${p.cliente_cnpj_cpf}<br>` : ''}
      ${p.cliente_endereco ? `${p.cliente_endereco}<br>` : ''}
      ${p.cliente_cidade || p.cliente_uf ? `${[p.cliente_cidade, p.cliente_uf].filter(Boolean).join(' — ')}<br>` : ''}
      ${p.cliente_telefone ? `Tel: ${p.cliente_telefone}<br>` : ''}
      ${p.cliente_email ? `${p.cliente_email}<br>` : ''}
    </div>
    <div class="parte">
      <div class="parte-titulo">VENDEDOR</div>
      <strong>${p.vendedor_nome ?? ''}</strong><br>
      ${p.vendedor_email ? `${p.vendedor_email}` : ''}
    </div>
  </div>
  <table class="itens">
    <thead>
      <tr>
        <th style="width:32px;text-align:center">#</th>
        <th>Descrição</th>
        <th style="width:50px;text-align:right">Qtd</th>
        <th style="width:100px;text-align:right">Valor Unit.</th>
        <th style="width:90px;text-align:right">Desconto</th>
        <th style="width:100px;text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${linhasItens || '<tr><td colspan="6" style="text-align:center;color:#888">Sem itens</td></tr>'}
    </tbody>
    <tfoot>
      ${linhasDesconto}
      <tr>
        <td colspan="5" style="text-align:right;border-top:2px solid #222;font-weight:bold;font-size:14px">TOTAL</td>
        <td style="text-align:right;border-top:2px solid #222;font-weight:bold;font-size:14px">${fmt(total)}</td>
      </tr>
    </tfoot>
  </table>
  ${condicoes || observacoes ? `
  <div class="rodape">
    ${condicoes ? `<div class="item"><strong>Condições de pagamento:</strong><span>${condicoes}</span></div>` : ''}
    ${observacoes ? `<div class="item"><strong>Observações:</strong><span>${observacoes}</span></div>` : ''}
  </div>` : ''}
  <div class="assinatura">
    <div class="assinatura-bloco">
      <div class="assinatura-linha">${setup?.empresa_nome ?? 'Videomart Broadcast'}</div>
    </div>
    <div class="assinatura-bloco">
      <div class="assinatura-linha">Cliente / Aprovação</div>
    </div>
  </div>
</body>
</html>`
}

export async function gerarPdfProposta(htmlContent: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: 'load' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '16px', bottom: '16px', left: '16px', right: '16px' } })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
