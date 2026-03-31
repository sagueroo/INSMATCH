import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** En dev, le navigateur n’appelle que :5173 ; Vite relaie vers l’API (évite le blocage Chrome localhost → 127.0.0.1). */
const apiTarget = process.env.VITE_DEV_API_PROXY ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/auth': { target: apiTarget, changeOrigin: true },
      '/chat': { target: apiTarget, changeOrigin: true },
      '/requests': { target: apiTarget, changeOrigin: true },
      '/profile': { target: apiTarget, changeOrigin: true },
      '/community': { target: apiTarget, changeOrigin: true },
      '/venues': { target: apiTarget, changeOrigin: true },
      '/schedule': { target: apiTarget, changeOrigin: true },
      '/group-events': { target: apiTarget, changeOrigin: true },
      '/notifications': { target: apiTarget, changeOrigin: true },
    },
  },
})