import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Match start.sh's explicit IPv4 bind. `localhost` can resolve to ::1
      // while Uvicorn only listens on 127.0.0.1, which makes Vite return 502.
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
