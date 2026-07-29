import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTelegramMiniApp } from '@/lib/telegram'
import './index.css'

initTelegramMiniApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
