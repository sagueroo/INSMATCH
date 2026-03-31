import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

// Dev : chemins relatifs (/profile…) → même origine que Vite (5173), proxy vers l’API. Prod : même origine que Nginx.
axios.defaults.baseURL = ''

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
