import cookieParser from 'cookie-parser'
import express from 'express'
import { pool } from './db.js'
import { authRouter } from './routes/auth.js'
import { clientesRouter } from './routes/clientes.js'
import { dashboardRouter } from './routes/dashboard.js'
import { produtosRouter } from './routes/produtos.js'
import { propostasRouter } from './routes/propostas.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api/clientes', clientesRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/produtos', produtosRouter)
app.use('/api/propostas', propostasRouter)

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'conectado' })
  } catch (err) {
    res.status(503).json({ status: 'ok', database: `falha na conexão: ${(err as Error).message}` })
  }
})

app.listen(port, () => {
  console.log(`vm2026 backend ouvindo na porta ${port}`)
})
