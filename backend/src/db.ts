import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'db',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: 5,
  // Explícito por precaução: o MySQL deste container tem character_set_client/
  // connection/results em latin1 por padrão (mesmo o banco sendo utf8mb4) — só
  // afeta clientes que não fixam o charset da sessão (ex.: CLI "mysql" sem
  // --default-character-set, usado nas migrations). O driver mysql2 já usa
  // utf8mb4 por padrão, mas fixar aqui evita depender desse comportamento implícito.
  charset: 'utf8mb4',
})
