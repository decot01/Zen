import { telegramHaptic } from '@/lib/telegram'

/**
 * Prefer Telegram HapticFeedback inside Mini Apps;
 * also try Vibration API — TG often exposes HF but it no-ops on some clients.
 */
export type HapticKind = 'collect' | 'combo' | 'death' | 'ui'

const PATTERNS: Record<HapticKind, number | number[]> = {
  collect: 12,
  combo: [12, 30, 18],
  death: [30, 40, 55],
  ui: 8,
}

export class Haptics {
  private enabled = true

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  isSupported(): boolean {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      return true
    }
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  }

  pulse(kind: HapticKind): void {
    if (!this.enabled) return

    telegramHaptic(kind)

    // Don't early-return after TG — HF can "succeed" with zero vibration.
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return
    }
    try {
      navigator.vibrate(PATTERNS[kind])
    } catch {
      // Some browsers throw if vibration is blocked
    }
  }
}
