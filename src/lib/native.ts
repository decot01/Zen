import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { App } from '@capacitor/app'
import { syncChromeSafeArea } from '@/lib/chrome'

/** Native shell boot — no-op in browser. */
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    // Draw under system bars; CSS safe-area insets keep HUD clear of notch.
    await StatusBar.setOverlaysWebView({ overlay: true })
    await StatusBar.setStyle({ style: Style.Dark })
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#00000000' })
    }
  } catch {
    // StatusBar may be unavailable on some devices
  }

  syncChromeSafeArea()

  window.addEventListener('resize', () => syncChromeSafeArea())
  window.visualViewport?.addEventListener('resize', () => syncChromeSafeArea())

  try {
    await SplashScreen.hide()
  } catch {
    // ignore
  }

  App.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) {
      void App.exitApp()
    }
  })

  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) syncChromeSafeArea()
  })
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
