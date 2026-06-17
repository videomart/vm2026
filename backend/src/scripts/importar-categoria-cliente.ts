// Backfill: importa empresa.CATEGORIA do vm2025 para clientes.categoria_cliente_id no vm2026.
// Idempotente: faz lookup por nome normalizado, cria categoria nova se não existir no
// seed de categorias_cliente, e só atualiza clientes ainda sem categoria.
//
// Uso: cd backend && npx tsx src/scripts/importar-categoria-cliente.ts

import fs from 'node:fs'
import path from 'node:path'
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

async function main() {
  // mapa ID legado -> ID novo, reconstruído pelo mesmo critério usado na importação original
  // (ordem de inserção por e.ID ASC == ordem de inserção em clientes)
  const [empresas] = await origem.query<RowDataPacket[]>(`
    SELECT e.ID, e.CATEGORIA
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

  const [categoriasExistentes] = await destino.query<RowDataPacket[]>(
    `SELECT id, nome FROM categorias_cliente`,
  )
  const mapaCategoria = new Map<string, number>()
  for (const c of categoriasExistentes) mapaCategoria.set(normalizar(c.nome as string), c.id as number)

  let criadas = 0
  let atualizados = 0
  let semCategoria = 0

  for (let i = 0; i < empresas.length; i++) {
    const categoriaTexto = (empresas[i].CATEGORIA as string | null)?.trim()
    const clienteId = clientesDestino[i].id as number

    if (!categoriaTexto) { semCategoria++; continue }

    const chave = normalizar(categoriaTexto)
    let categoriaId = mapaCategoria.get(chave)

    if (!categoriaId) {
      const [r] = await destino.query<ResultSetHeader>(
        `INSERT IGNORE INTO categorias_cliente (nome) VALUES (?)`,
        [chave],
      )
      if (r.insertId) {
        categoriaId = r.insertId
        criadas++
      } else {
        // já existe com essa grafia exata (colisão não pega pela normalização prévia)
        const [rows] = await destino.query<RowDataPacket[]>(
          `SELECT id FROM categorias_cliente WHERE nome = ?`,
          [chave],
        )
        categoriaId = rows[0]?.id as number
      }
      mapaCategoria.set(chave, categoriaId)
    }

    await destino.query(
      `UPDATE clientes SET categoria_cliente_id = ? WHERE id = ? AND categoria_cliente_id IS NULL`,
      [categoriaId, clienteId],
    )
    atualizados++
  }

  console.log(`Categorias novas criadas: ${criadas}`)
  console.log(`Clientes atualizados com categoria: ${atualizados}`)
  console.log(`Clientes sem categoria no legado: ${semCategoria}`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => { origem.end(); destino.end() })
