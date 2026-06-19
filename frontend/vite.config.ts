import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// Em produção (Dockerfile.prod) o build roda sem acesso ao .git (o COPY só traz a
// pasta frontend/), então o hash vem via --build-arg APP_VERSION (definido no
// docker-compose.prod.yml a partir do host, que tem o repo completo). Em dev local,
// cai para "git rev-parse" direto.
function appVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim()
    const data = execSync('git log -1 --format=%cd --date=format:%Y-%m-%d').toString().trim()
    return `${hash} (${data})`
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['vm2026.tvtupi.com.br'],
    proxy: {
      '/api': {
        target: 'http://backend:3001',
        changeOrigin: true,
      },
    },
  },
})
