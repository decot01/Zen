/**
 * Light mobile vibration via Vibration API.
 * No-ops on unsupported browsers / when disabled.
 */
export type HapticKind = 'collect' | 'combo' | 'death' | 'ui'

const PATTERNS: Record<HapticKind, number | number[]> = {
  collect: 8,
  combo: [10, 24, 14],
  death: [28, 40, 48],
  ui: 6,
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
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  }

  pulse(kind: HapticKind): void {
    if (!this.enabled || !this.isSupported()) return
    try {
      navigator.vibrate(PATTERNS[kind])
    } catch {
      // Some browsers throw if vibration is blocked
    }
  }
}
