import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Backend en dev (proxy Vite). Sur la VM : http://127.0.0.1:8000 */
const apiTarget = process.env.VITE_DEV_API_PROXY ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    // HTTPS + domaine : sans ça Vite affiche "Blocked request... allowedHosts"
    allowedHosts: ['localhost', '127.0.0.1', 'insmatch.swiloz.com'],
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
