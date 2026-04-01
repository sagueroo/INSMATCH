import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Préfixe API (backend monte auth, profile, chat… sous /api/...). En dev, Vite proxy `/api` → serveur Node.
axios.defaults.baseURL = import.meta.env.VITE_API_BASE || '/api'

registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
