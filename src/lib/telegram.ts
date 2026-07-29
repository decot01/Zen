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

export interface TelegramSafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
}

export interface TelegramWebApp {
  initData: string
  ready: () => void
  expand: () => void
  close: () => void
  disableVerticalSwipes?: () => void
  requestFullscreen?: () => void
  exitFullscreen?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  isExpanded: boolean
  isFullscreen?: boolean
  viewportHeight: number
  viewportStableHeight: number
  platform: string
  version: string
  isVersionAtLeast: (version: string) => boolean
  safeAreaInset?: TelegramSafeAreaInset
  contentSafeAreaInset?: TelegramSafeAreaInset
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

const EXTRA_TOP_GAP = 12
/** When TG chrome insets report 0 (common before fullscreen / on some clients). */
const TG_TOP_FALLBACK = 62
const EXTRA_BOTTOM_GAP = 8
const TG_BOTTOM_FALLBACK = 16

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

/** Top/bottom chrome insets in CSS pixels for HUD + spawn padding. */
export function getChromeInsets(): { top: number; bottom: number } {
  const wa = getTelegramWebApp()
  if (!wa?.initData) {
    return { top: 0, bottom: 0 }
  }

  const safeTop = wa.safeAreaInset?.top ?? 0
  const contentTop = wa.contentSafeAreaInset?.top ?? 0
  const safeBottom = wa.safeAreaInset?.bottom ?? 0
  const contentBottom = wa.contentSafeAreaInset?.bottom ?? 0

  let top = safeTop + contentTop
  let bottom = safeBottom + contentBottom

  // Minimal / compact header often under-reports until fullscreen settles.
  if (top < 24) top = TG_TOP_FALLBACK
  if (bottom < 8) bottom = TG_BOTTOM_FALLBACK

  return {
    top: top + EXTRA_TOP_GAP,
    bottom: bottom + EXTRA_BOTTOM_GAP,
  }
}

export function syncTelegramSafeArea(): { top: number; bottom: number } {
  const { top, bottom } = getChromeInsets()
  const root = document.documentElement
  root.style.setProperty('--zen-safe-top', `${top}px`)
  root.style.setProperty('--zen-safe-bottom', `${bottom}px`)
  root.style.setProperty(
    '--zen-spawn-top',
    `${Math.max(108, top + 72)}px`,
  )
  return { top, bottom }
}

/** Prefer calling from a user gesture (Play) — TG often ignores auto fullscreen. */
export function requestTelegramFullscreen(): void {
  const wa = getTelegramWebApp()
  if (!wa?.initData) return
  try {
    wa.expand()
    wa.requestFullscreen?.()
  } catch {
    // Client may show its own Fullscreen button instead.
  }
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
    wa.requestFullscreen?.()
  } catch {
    // Older Telegram clients may miss some methods.
  }

  syncTelegramSafeArea()

  const resync = () => syncTelegramSafeArea()
  wa.onEvent?.('fullscreenChanged', resync)
  wa.onEvent?.('viewportChanged', resync)
  wa.onEvent?.('safeAreaChanged', resync)
  wa.onEvent?.('contentSafeAreaChanged', resync)
}
