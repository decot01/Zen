/**
 * Thin wrapper around Telegram.WebApp (script in index.html).
 * No-ops outside Telegram so the game still runs on the open web.
 */

export interface TelegramHapticFeedback {
  impactOccurred: (
    style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft',
  ) => TelegramHapticFeedback
  notificationOccurred: (
    type: 'error' | 'success' | 'warning',
  ) => TelegramHapticFeedback
  selectionChanged: () => TelegramHapticFeedback
}

export interface TelegramWebApp {
  initData: string
  ready: () => void
  expand: () => void
  close: () => void
  disableVerticalSwipes?: () => void
  requestFullscreen?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  platform: string
  version: string
  isVersionAtLeast: (version: string) => boolean
  HapticFeedback?: TelegramHapticFeedback
  onEvent?: (eventType: string, callback: () => void) => void
  offEvent?: (eventType: string, callback: () => void) => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  try {
    return window.Telegram?.WebApp ?? null
  } catch {
    return null
  }
}

export function isTelegramMiniApp(): boolean {
  const wa = getTelegramWebApp()
  return Boolean(wa?.initData)
}

/** Call as early as possible so TG hides the loading placeholder. */
export function initTelegramMiniApp(): void {
  const wa = getTelegramWebApp()
  if (!wa) return

  try {
    wa.ready()
    wa.expand()
    wa.setHeaderColor?.('#000000')
    wa.setBackgroundColor?.('#000000')
    // Hold-to-play conflicts with TG's pull-to-close gesture.
    wa.disableVerticalSwipes?.()
    // Best effort — older clients ignore this.
    wa.requestFullscreen?.()
  } catch {
    // Older Telegram clients may miss some methods.
  }
}

export function telegramHaptic(
  kind: 'collect' | 'combo' | 'death' | 'ui',
): boolean {
  const hf = getTelegramWebApp()?.HapticFeedback
  if (!hf) return false
  try {
    switch (kind) {
      case 'collect':
        hf.impactOccurred('light')
        break
      case 'combo':
        hf.notificationOccurred('success')
        break
      case 'death':
        hf.notificationOccurred('error')
        break
      case 'ui':
        hf.selectionChanged()
        break
    }
    return true
  } catch {
    return false
  }
}
