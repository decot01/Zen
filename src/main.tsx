import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { syncChromeSafeArea } from '@/lib/chrome'
import { initNativeShell } from '@/lib/native'
import { startPortraitOrientationLock } from '@/lib/orientation'
import './index.css'

void initNativeShell()
syncChromeSafeArea()
startPortraitOrientationLock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
