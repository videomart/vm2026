import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'db',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: 5,
})
