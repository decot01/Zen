import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { warmCloudSync } from '@/lib/cloudSync'
import { initTelegramMiniApp } from '@/lib/telegram'
import './index.css'

initTelegramMiniApp()
warmCloudSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
