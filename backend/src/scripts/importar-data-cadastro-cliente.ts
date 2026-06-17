// Backfill: importa empresa.DATA do vm2025 para clientes.criado_em no vm2026.
// O script de importação original (importar-vm2025.ts) não trouxe essa coluna,
// então criado_em ficou com o DEFAULT CURRENT_TIMESTAMP do momento da importação
// em massa (mesmo valor para milhares de linhas).
//
// Uso: cd backend && npx tsx src/scripts/importar-data-cadastro-cliente.ts

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

async function main() {
  // mesma premissa do backfill de categoria: ordem de e.ID ASC == ordem de inserção em clientes
  const [empresas] = await origem.query<RowDataPacket[]>(`
    SELECT e.ID, e.DATA
    FROM empresa e
    ORDER BY e.ID
  `)

  const [clientesDestino] = await destino.query<RowDataPacket[]>(
    `SELECT id FROM clientes ORDER BY id ASC`,
  )

  if (empresas.length !== clientesDestino.length) {
    console.error(
      `Contagem divergente: ${empresas.length} empresas no legado vs ${clientesDestino.length} clientes no vm2026. ` +
      `O backfill assume 1:1 na mesma ordem de ID — abortando para evitar associação errada.`,
    )
    process.exit(1)
  }

  let atualizados = 0
  let semData = 0

  for (let i = 0; i < empresas.length; i++) {
    const data = empresas[i].DATA as Date | string | null
    const clienteId = clientesDestino[i].id as number

    if (!data) { semData++; continue }

    const iso = data instanceof Date ? data.toISOString().slice(0, 10) : String(data).slice(0, 10)

    await destino.query(
      `UPDATE clientes SET criado_em = ? WHERE id = ?`,
      [`${iso} 00:00:00`, clienteId],
    )
    atualizados++
  }

  console.log(`Clientes atualizados com data de cadastro original: ${atualizados}`)
  console.log(`Clientes sem data no legado (criado_em mantido): ${semData}`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => { origem.end(); destino.end() })
