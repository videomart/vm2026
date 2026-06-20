import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { pool } from './db.js'
import { authRouter } from './routes/auth.js'
import { clientesRouter } from './routes/clientes.js'
import { dashboardRouter } from './routes/dashboard.js'
import { leadsRouter } from './routes/leads.js'
import { produtosRouter } from './routes/produtos.js'
import { propostasRouter } from './routes/propostas.js'
import { usuariosRouter } from './routes/usuarios.js'
import { setupRouter } from './routes/setup.js'
import { marcasRouter } from './routes/marcas.js'
import { categoriasRouter } from './routes/categorias.js'
import { categoriasClienteRouter } from './routes/categoriasCliente.js'
import { templatesEmailRouter } from './routes/templatesEmail.js'
import { campanhasRouter } from './routes/campanhas.js'
import { contasReceberRouter } from './routes/contasReceber.js'
import { contasPagarRouter } from './routes/contasPagar.js'
import { fornecedoresRouter } from './routes/fornecedores.js'
import { categoriasDespesaRouter } from './routes/categoriasDespesa.js'
import { contasSmtpRouter } from './routes/contasSmtp.js'
import { retomarCampanhasTravadas, verificarPropostasParadas } from './email.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.use(express.json({ limit: '2mb' }))
// O formulário do site (salvadb.php) envia application/x-www-form-urlencoded, não JSON.
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api/clientes', clientesRouter)
app.use('/api/dashboard', dashboardRouter)
// CORS aberto só para a captura pública de leads pelo site (sem cookies/credenciais).
app.use('/api/leads/captura', cors())
app.use('/api/leads/captura-site', cors())
app.use('/api/leads', leadsRouter)
app.use('/api/produtos', produtosRouter)
app.use('/api/propostas', propostasRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/setup', setupRouter)
app.use('/api/marcas', marcasRouter)
app.use('/api/categorias', categoriasRouter)
app.use('/api/categorias-cliente', categoriasClienteRouter)
app.use('/api/templates-email', templatesEmailRouter)
app.use('/api/campanhas', campanhasRouter)
app.use('/api/contas-receber', contasReceberRouter)
app.use('/api/contas-pagar', contasPagarRouter)
app.use('/api/fornecedores', fornecedoresRouter)
app.use('/api/categorias-despesa', categoriasDespesaRouter)
app.use('/api/contas-smtp', contasSmtpRouter)

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'conectado' })
  } catch (err) {
    res.status(503).json({ status: 'ok', database: `falha na conexão: ${(err as Error).message}` })
  }
})

// Em produção, o build do frontend é copiado para ./public (ver Dockerfile.prod) e
// servido pelo próprio Express — evita precisar de um container/proxy separado para o
// frontend. Em desenvolvimento essa pasta não existe e o bloco é ignorado (o frontend
// roda à parte via Vite dev server).
const pastaFrontend = path.join(import.meta.dirname, 'public')
if (fs.existsSync(pastaFrontend)) {
  app.use(express.static(pastaFrontend))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(pastaFrontend, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`vm2026 backend ouvindo na porta ${port}`)
  retomarCampanhasTravadas()

  // Verifica propostas paradas uma vez ao iniciar, depois a cada 24h — não precisa
  // de cron externo, roda dentro do próprio processo (igual a retomarCampanhasTravadas).
  verificarPropostasParadas()
  setInterval(verificarPropostasParadas, 24 * 60 * 60 * 1000)
})
