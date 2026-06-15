// Script one-off de importação dos leads históricos do vm2025 (tabela `leads`, ~13.5k
// registros de 2014+ vindos do formulário do site) para a nova tabela `leads` do vm2026.
// Roda do host, conectando diretamente nas duas bases via portas expostas pelo Docker:
//   vm2025 -> 127.0.0.1:3306, vm2026 -> 127.0.0.1:<DB_PORT>
//
// Uso: cd backend && npx tsx src/scripts/importar-leads-vm2025.ts

import fs from 'node:fs'
import path from 'node:path'
import mysql, { type RowDataPacket } from 'mysql2/promise'

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

// Único sentinela de "ainda não atribuído" em uso desde 2024 (os demais — SEM-CONSULTOR,
// SEM-CONSULTO, NEW, designar, vazio — são de 2014-2022 e ficam como histórico).
const SENTINELA_NAO_ATRIBUIDO = 'CADASTRAR-CONSULTOR'

async function mapearVendedoresAtivos(): Promise<Map<string, number>> {
  const [funcionarios] = await origem.query<RowDataPacket[]>(
    "SELECT NOME, EMAIL, USUARIO FROM funcionario WHERE ATIVO = 'SIM'",
  )

  const mapa = new Map<string, number>()
  for (const f of funcionarios) {
    if (!f.USUARIO) continue
    let email = (f.EMAIL as string | null)?.trim().toLowerCase() || ''
    if (!email) {
      const base = ((f.USUARIO as string | null) || '').trim().toLowerCase().replace(/\s+/g, '.')
      email = `${base}@videomart.com.br`
    }
    const [[usuario]] = await destino.query<RowDataPacket[]>('SELECT id FROM usuarios WHERE email = ?', [email])
    if (usuario) mapa.set(normalizar(f.USUARIO as string), usuario.id as number)
  }
  return mapa
}

async function importarLeads(mapaVendedor: Map<string, number>) {
  const [leads] = await origem.query<RowDataPacket[]>(
    'SELECT ID, EMPRESA, CONTATO, TELEFONE, EMAIL, CIDADE, UF, ASSUNTO, INFO, DATA, COD_VEND FROM leads ORDER BY ID',
  )

  let novos = 0
  let comVendedor = 0

  for (const lote of dividirEmLotes(leads, 500)) {
    const valores = lote.map((l) => {
      const codVend = (l.COD_VEND as string | null)?.trim() || ''
      const vendedorId = (codVend && mapaVendedor.get(normalizar(codVend))) || null
      if (vendedorId) comVendedor++

      const naoAtribuido = codVend.toUpperCase() === SENTINELA_NAO_ATRIBUIDO
      const status = naoAtribuido ? 'novo' : 'descartado'
      if (naoAtribuido) novos++

      let uf = (l.UF as string | null)?.trim().toUpperCase() || ''
      if (uf.length !== 2) uf = ''

      return [
        (l.EMPRESA as string | null)?.trim()?.slice(0, 150) || null,
        (l.CONTATO as string | null)?.trim()?.slice(0, 150) || null,
        (l.TELEFONE as string | null)?.trim() || null,
        (l.EMAIL as string | null)?.trim() || null,
        (l.CIDADE as string | null)?.trim()?.slice(0, 100) || null,
        uf || null,
        (l.ASSUNTO as string | null)?.trim()?.slice(0, 120) || null,
        ((l.INFO as string | null) || '').slice(0, 60000) || null,
        'site',
        vendedorId,
        status,
        l.DATA,
      ]
    })

    await destino.query(
      `INSERT INTO leads
         (nome_empresa, contato, telefone, email, cidade, uf, assunto, mensagem, origem, vendedor_id, status, criado_em)
       VALUES ?`,
      [valores],
    )
  }

  console.log(`Leads: ${leads.length} importados de "leads" (vm2025).`)
  console.log(`  - ${novos} marcados como 'novo' (cod_vend = '${SENTINELA_NAO_ATRIBUIDO}', 2024+, ainda não trabalhados)`)
  console.log(`  - ${leads.length - novos} marcados como 'descartado' (histórico, já tratados em sua época)`)
  console.log(`  - ${comVendedor} associados a um vendedor ativo via cod_vend`)
}

async function main() {
  console.log('Importando leads históricos do vm2025 para o vm2026...\n')

  const mapaVendedor = await mapearVendedoresAtivos()
  await importarLeads(mapaVendedor)

  console.log('\nImportação concluída.')
  await origem.end()
  await destino.end()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
