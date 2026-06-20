import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Versão e data vêm do arquivo buildInfo.ts (commitado no git) — atualizado pelo
// agente de desenvolvimento a cada commit relevante, não depende do .git estar
// disponível no contexto de build do Docker (que só copia a pasta frontend/).
const buildInfoSrc = readFileSync('./src/buildInfo.ts', 'utf-8')
const versionMatch = buildInfoSrc.match(/BUILD_VERSION\s*=\s*'([^']+)'/)
const dateMatch = buildInfoSrc.match(/BUILD_DATE\s*=\s*'([^']+)'/)
const APP_VERSION = versionMatch?.[1] ?? '0.0.0'
const BUILD_TIME = dateMatch?.[1] ?? '—'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD__: JSON.stringify(APP_VERSION),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
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
