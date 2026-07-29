import { getTelegramWebApp } from '@/lib/telegram'

/**
 * Shared tactile feel for gameplay + UI.
 * Soft presets — TG only exposes fixed styles, so "pleasant" beats "loud".
 */
export type HapticKind = 'collect' | 'combo' | 'death' | 'ui' | 'tap'

const PATTERNS: Record<HapticKind, number | number[]> = {
  collect: 5,
  combo: 7,
  death: [12, 22, 16],
  ui: 4,
  tap: 3,
}

let enabled = true

export function setHapticsEnabled(value: boolean): void {
  enabled = value
}

export function isHapticsEnabled(): boolean {
  return enabled
}

export function isHapticsSupported(): boolean {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
    return true
  }
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

function telegramPulse(kind: HapticKind): boolean {
  const wa = getTelegramWebApp()
  const hf = wa?.HapticFeedback
  if (!hf || !wa?.initData) return false

  const platform = (wa.platform || '').toLowerCase()
  if (platform === 'tdesktop' || platform === 'web' || platform === 'weba') {
    return false
  }

  try {
    switch (kind) {
      case 'collect':
        hf.impactOccurred('soft')
        break
      case 'combo':
        hf.impactOccurred('light')
        break
      case 'death':
        hf.notificationOccurred('warning')
        break
      case 'ui':
        hf.selectionChanged()
        break
      case 'tap':
        hf.impactOccurred('soft')
        break
    }
    return true
  } catch {
    return false
  }
}

export function pulseHaptic(kind: HapticKind): void {
  if (!enabled) return

  telegramPulse(kind)

  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return
  }
  try {
    navigator.vibrate(PATTERNS[kind])
  } catch {
    // Vibration blocked
  }
}
