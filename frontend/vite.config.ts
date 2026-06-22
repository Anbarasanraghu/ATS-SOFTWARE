import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev server (localhost / LAN).
  server: { host: true, allowedHosts: true, proxy },
  // Production preview (used for reliable phone/tunnel testing — bundled app).
  preview: { host: true, allowedHosts: true, proxy },
})
