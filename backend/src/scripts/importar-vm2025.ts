// Script one-off de importação de dados do vm2025 (clientes, contatos, produtos, propostas).
// Roda do host, conectando diretamente nas duas bases via portas expostas pelo Docker:
//   vm2025 -> 127.0.0.1:3306, vm2026 -> 127.0.0.1:<DB_PORT>
//
// Uso: cd backend && npx tsx src/scripts/importar-vm2025.ts

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import mysql, { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'

function carregarEnv(caminho: string) {
  if (!fs.existsSync(caminho)) return
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const chave = trimmed.slice(0, idx).trim()
    const valor = trimmed.slice(idx + 1).trim()
    if (!(chave in process.env)) process.env[chave] = valor
  }
}

carregarEnv(path.resolve(import.meta.dirname, '../../../.env'))

const origem = mysql.createPool({
  host: process.env.VM2025_DB_HOST ?? '127.0.0.1',
  port: Number(process.env.VM2025_DB_PORT ?? 3306),
  user: process.env.VM2025_DB_USER ?? 'root',
  password: process.env.VM2025_DB_PASSWORD ?? 'troque_esta_senha',
  database: process.env.VM2025_DB_NAME ?? 'vm2025',
  charset: 'utf8mb4',
})

const destino = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  charset: 'utf8mb4',
})

function normalizar(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ')
}

function dividirEmLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho))
  return lotes
}

async function importarVendedores() {
  const [funcionarios] = await origem.query<RowDataPacket[]>(
    "SELECT ID, NOME, EMAIL, USUARIO FROM funcionario WHERE ATIVO = 'SIM'",
  )

  const mapaVendedor = new Map<string, number>()

  for (const f of funcionarios) {
    const nome = (f.NOME as string | null)?.trim() || `Vendedor ${f.ID}`
    let email = (f.EMAIL as string | null)?.trim().toLowerCase() || ''
    if (!email) {
      const base = ((f.USUARIO as string | null) || `vendedor${f.ID}`).trim().toLowerCase().replace(/\s+/g, '.')
      email = `${base}@videomart.com.br`
    }

    const senhaHash = await bcrypt.hash(crypto.randomUUID(), 10)
    await destino.query(
      `INSERT IGNORE INTO usuarios (nome, email, senha_hash, papel, ativo) VALUES (?, ?, ?, 'vendedor', 1)`,
      [nome, email, senhaHash],
    )

    const [[usuario]] = await destino.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ?', [email])
    if (usuario && f.USUARIO) {
      mapaVendedor.set(normalizar(f.USUARIO as string), usuario.id)
    }
  }

  const emailPlaceholder = 'importacao.vm2025@videomart.com.br'
  await destino.query(
    `INSERT IGNORE INTO usuarios (nome, email, senha_hash, papel, ativo)
     VALUES ('Importação vm2025', ?, ?, 'vendedor', 0)`,
    [emailPlaceholder, await bcrypt.hash(crypto.randomUUID(), 10)],
  )
  const [[placeholder]] = await destino.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ?', [
    emailPlaceholder,
  ])

  console.log(`Vendedores: ${funcionarios.length} ativos no vm2025, ${mapaVendedor.size} mapeados por USUARIO.`)
  return { mapaVendedor, idPlaceholder: placeholder.id as number }
}

async function importarClientes() {
  const [empresas] = await origem.query<RowDataPacket[]>(`
    SELECT e.ID, e.RAZAO_SOCIAL, e.EMPRESA, e.ENDERECO, e.CEP, e.TELEFONE, e.WHATSAPP,
           e.CNPJ_CPF, e.EMAIL, e.OBS, c.cidade, c.uf
    FROM empresa e
    LEFT JOIN cidade c ON c.ID = e.ID_CIDADE
    ORDER BY e.ID
  `)

  const mapaCliente = new Map<number, number>()

  for (const lote of dividirEmLotes(empresas, 500)) {
    const valores = lote.map((e) => [
      ((e.RAZAO_SOCIAL as string | null)?.trim() || (e.EMPRESA as string | null)?.trim() || `Empresa ${e.ID}`).slice(
        0,
        200,
      ),
      (e.EMPRESA as string | null)?.trim()?.slice(0, 200) || null,
      (e.CNPJ_CPF as string | null)?.trim() || null,
      (e.EMAIL as string | null)?.trim() || null,
      (e.TELEFONE as string | null)?.trim() || null,
      (e.WHATSAPP as string | null)?.trim() || null,
      (e.ENDERECO as string | null)?.trim() || null,
      (e.cidade as string | null)?.trim() || null,
      (e.uf as string | null)?.trim() || null,
      (e.CEP as string | null)?.trim() || null,
      (e.OBS as string | null) || null,
    ])

    const [resultado] = await destino.query<ResultSetHeader>(
      `INSERT INTO clientes
         (razao_social, nome_fantasia, cnpj_cpf, email, telefone, whatsapp, endereco, cidade, uf, cep, observacoes)
       VALUES ?`,
      [valores],
    )

    const primeiroId = resultado.insertId
    lote.forEach((e, i) => mapaCliente.set(e.ID as number, primeiroId + i))
  }

  console.log(`Clientes: ${empresas.length} importados de "empresa".`)
  return mapaCliente
}

async function importarContatos(mapaCliente: Map<number, number>) {
  const [contatos] = await origem.query<RowDataPacket[]>(
    'SELECT ID, ID_EMPRESA, CONTATO, TELEFONE, CELULAR, WHATSAPP, CARGO, EMAIL FROM contato ORDER BY ID',
  )

  let pulados = 0
  const linhas: unknown[][] = []
  for (const c of contatos) {
    const clienteId = mapaCliente.get(c.ID_EMPRESA as number)
    if (!clienteId) {
      pulados++
      continue
    }
    const nome = (c.CONTATO as string | null)?.trim() || 'Contato sem nome'
    linhas.push([
      clienteId,
      nome.slice(0, 100),
      (c.CARGO as string | null)?.trim() || null,
      (c.TELEFONE as string | null)?.trim() || null,
      (c.CELULAR as string | null)?.trim() || null,
      (c.WHATSAPP as string | null)?.trim() || null,
      (c.EMAIL as string | null)?.trim() || null,
    ])
  }

  for (const lote of dividirEmLotes(linhas, 500)) {
    await destino.query(
      `INSERT INTO contatos (cliente_id, nome, cargo, telefone, celular, whatsapp, email) VALUES ?`,
      [lote],
    )
  }

  console.log(`Contatos: ${linhas.length} importados de "contato" (${pulados} sem empresa correspondente, pulados).`)
}

async function importarProdutos() {
  const [produtos] = await origem.query<RowDataPacket[]>(`
    SELECT p.ID, p.MODELO, p.DESCRICAO, p.CUSTO, p.VENDA, p.PESO, m.MARCA, cl.CLASSE
    FROM produto p
    LEFT JOIN marca m ON m.ID = p.ID_MARCA
    LEFT JOIN classe cl ON cl.ID = p.ID_CLASSE
    ORDER BY p.ID
  `)

  for (const lote of dividirEmLotes(produtos, 500)) {
    const valores = lote.map((p) => [
      (p.MODELO as string).trim(),
      (p.DESCRICAO as string | null)?.trim()?.slice(0, 200) || null,
      (p.MARCA as string | null)?.trim() || null,
      (p.CLASSE as string | null)?.trim() || null,
      p.CUSTO ?? null,
      p.VENDA ?? null,
      p.PESO ?? null,
    ])
    await destino.query(
      `INSERT IGNORE INTO produtos (modelo, descricao, marca, categoria, preco_custo, preco_venda, peso) VALUES ?`,
      [valores],
    )
  }

  const [produtosDestino] = await destino.query<RowDataPacket[]>('SELECT id, modelo FROM produtos')
  const mapaProduto = new Map<string, number>()
  for (const p of produtosDestino) mapaProduto.set(normalizar(p.modelo as string), p.id as number)

  console.log(`Produtos: ${produtos.length} processados de "produto" (${produtosDestino.length} agora em "produtos").`)
  return mapaProduto
}

async function importarPropostas(
  mapaCliente: Map<number, number>,
  mapaVendedor: Map<string, number>,
  mapaProduto: Map<string, number>,
  idPlaceholder: number,
) {
  const [propostas] = await origem.query<RowDataPacket[]>(`
    SELECT ID, ID_EMPRESA, natureza, data, cod_vend, total, desconto, condpag, obs
    FROM proposta
    WHERE data >= '2015-01-01'
    ORDER BY ID
  `)

  const [todosItens] = await origem.query<RowDataPacket[]>(`
    SELECT ip.ID_PROPOSTA, ip.MODELO, ip.DESCRICAO, ip.UNIT, ip.DESCONTO, ip.QTY, ip.SUBTOTAL
    FROM itemproposta ip
    JOIN proposta p ON p.ID = ip.ID_PROPOSTA
    WHERE p.data >= '2015-01-01'
  `)
  const itensPorProposta = new Map<number, RowDataPacket[]>()
  for (const it of todosItens) {
    const lista = itensPorProposta.get(it.ID_PROPOSTA as number) ?? []
    lista.push(it)
    itensPorProposta.set(it.ID_PROPOSTA as number, lista)
  }

  let propostasPuladas = 0
  let propostasInseridas = 0
  let itensInseridos = 0
  let itensSemProduto = 0
  const vendedoresNaoMapeados = new Map<string, number>()

  for (const p of propostas) {
    const clienteId = mapaCliente.get(p.ID_EMPRESA as number)
    if (!clienteId) {
      propostasPuladas++
      continue
    }

    const codVend = (p.cod_vend as string | null)?.trim() || ''
    const vendedorId = (codVend && mapaVendedor.get(normalizar(codVend))) || idPlaceholder

    let observacoes = ((p.obs as string | null) || '').trim()
    if (vendedorId === idPlaceholder && codVend) {
      observacoes += `${observacoes ? '\n' : ''}[Vendedor original: ${codVend}]`
      vendedoresNaoMapeados.set(codVend, (vendedoresNaoMapeados.get(codVend) ?? 0) + 1)
    }
    const condpag = (p.condpag as string | null)?.trim() || ''
    if (condpag.length > 200) {
      observacoes += `${observacoes ? '\n' : ''}Condições de pagamento: ${condpag}`
    }

    const status = p.natureza === 'Venda' ? 'convertida' : 'aberta'
    const condicoesPagamento = condpag ? condpag.slice(0, 200) : null

    const [resultado] = await destino.query<ResultSetHeader>(
      `INSERT INTO propostas (cliente_id, vendedor_id, data, validade, condicoes_pagamento, observacoes, status, total, desconto)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      [
        clienteId,
        vendedorId,
        p.data,
        condicoesPagamento,
        observacoes.slice(0, 60000) || null,
        status,
        p.total ?? 0,
        p.desconto ?? 0,
      ],
    )
    propostasInseridas++
    const propostaId = resultado.insertId

    const itens = itensPorProposta.get(p.ID as number) ?? []
    if (itens.length > 0) {
      const valores = itens.map((it) => {
        const modelo = (it.MODELO as string | null)?.trim()
        const produtoId = modelo ? mapaProduto.get(normalizar(modelo)) ?? null : null
        if (!produtoId) itensSemProduto++
        return [
          propostaId,
          produtoId,
          ((it.DESCRICAO as string | null)?.trim() || modelo || 'Item').slice(0, 200),
          it.QTY ?? 1,
          it.UNIT ?? 0,
          it.DESCONTO ?? 0,
          it.SUBTOTAL ?? 0,
        ]
      })
      await destino.query(
        `INSERT INTO proposta_itens (proposta_id, produto_id, descricao, quantidade, valor_unitario, desconto, subtotal) VALUES ?`,
        [valores],
      )
      itensInseridos += itens.length
    }
  }

  console.log(
    `Propostas: ${propostasInseridas} inseridas, ${propostasPuladas} puladas (sem cliente correspondente).`,
  )
  console.log(`Itens de proposta: ${itensInseridos} inseridos (${itensSemProduto} sem produto correspondente).`)

  if (vendedoresNaoMapeados.size > 0) {
    console.log('\nPropostas atribuídas ao usuário "Importação vm2025" por vendedor original (cod_vend):')
    const ordenado = [...vendedoresNaoMapeados.entries()].sort((a, b) => b[1] - a[1])
    for (const [vendedor, qtd] of ordenado) console.log(`  ${vendedor}: ${qtd}`)
  }
}

async function main() {
  console.log('Importando dados do vm2025 para o vm2026...\n')

  const { mapaVendedor, idPlaceholder } = await importarVendedores()
  const mapaCliente = await importarClientes()
  await importarContatos(mapaCliente)
  const mapaProduto = await importarProdutos()
  await importarPropostas(mapaCliente, mapaVendedor, mapaProduto, idPlaceholder)

  console.log('\nImportação concluída.')
  await origem.end()
  await destino.end()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
