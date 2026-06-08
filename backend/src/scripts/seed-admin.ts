import bcrypt from 'bcryptjs'
import { pool } from '../db.js'

async function main() {
  const email = process.env.ADMIN_EMAIL
  const senha = process.env.ADMIN_PASSWORD
  const nome = process.env.ADMIN_NOME ?? 'Administrador'

  if (!email || !senha) {
    throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD para gerar o usuário admin.')
  }

  const senhaHash = await bcrypt.hash(senha, 10)

  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, papel, ativo)
     VALUES (?, ?, ?, 'admin', 1)
     ON DUPLICATE KEY UPDATE nome = VALUES(nome), senha_hash = VALUES(senha_hash), papel = 'admin', ativo = 1`,
    [nome, email, senhaHash],
  )

  console.log(`Usuário admin "${email}" criado/atualizado com sucesso.`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
