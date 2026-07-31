import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * Sparse haptic language (Apple HIG / Material motion guidance):
 * reinforce rare, meaningful moments — never decorate every tap or collect.
 *
 *   ui        — intentional UI confirm (mode, settings)
 *   milestone — prize / notable combo step
 *   danger    — threat telegraph (sniper lock)
 *   hit       — player takes a real hit
 *   death     — run end
 */
export type HapticKind = 'ui' | 'milestone' | 'danger' | 'hit' | 'death'

const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  ui: 8,
  milestone: [8, 30, 12],
  danger: [12, 40, 12],
  hit: 28,
  death: [24, 50, 40],
}

const ANDROID_MS: Record<HapticKind, number> = {
  ui: 10,
  milestone: 16,
  danger: 20,
  hit: 28,
  death: 40,
}

/** Wide cooldowns — silence between pulses is part of the design. */
const COOLDOWN_MS: Record<HapticKind, number> = {
  /** Soft UI confirm — buttons, toggles, mode switch. */
  ui: 70,
  milestone: 280,
  danger: 400,
  hit: 320,
  death: 800,
}

let enabled = true
let vibrateReady = false
const lastPulseAt: Partial<Record<HapticKind, number>> = {}
/** Global gate so distinct kinds can't stack into mush within ~90ms. */
let lastAnyAt = 0
const GLOBAL_GAP_MS = 90

export function setHapticsEnabled(value: boolean): void {
  enabled = value
}

export function isHapticsEnabled(): boolean {
  return enabled
}

export function isHapticsSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

function canPulse(kind: HapticKind): boolean {
  const now = performance.now()
  if (now - lastAnyAt < GLOBAL_GAP_MS) return false
  const last = lastPulseAt[kind] ?? 0
  if (now - last < COOLDOWN_MS[kind]) return false
  lastPulseAt[kind] = now
  lastAnyAt = now
  return true
}

async function capacitorPulse(kind: HapticKind): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    if (Capacitor.getPlatform() === 'android') {
      // Single clean tick — never stack Impact + vibrate.
      await Haptics.vibrate({ duration: ANDROID_MS[kind] })
      if (kind === 'death') {
        await new Promise((r) => setTimeout(r, 60))
        await Haptics.vibrate({ duration: 18 })
      }
      return
    }

    switch (kind) {
      case 'ui':
        await Haptics.selectionChanged()
        break
      case 'milestone':
        await Haptics.impact({ style: ImpactStyle.Light })
        break
      case 'danger':
        await Haptics.notification({ type: NotificationType.Warning })
        break
      case 'hit':
        await Haptics.impact({ style: ImpactStyle.Medium })
        break
      case 'death':
        await Haptics.notification({ type: NotificationType.Error })
        break
    }
  } catch {
    // Plugin unavailable
  }
}

function webVibrate(kind: HapticKind): void {
  if (!vibrateReady) {
    vibrateReady = true
    return
  }
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return
  }
  try {
    navigator.vibrate(WEB_PATTERNS[kind])
  } catch {
    // blocked
  }
}

export function pulseHaptic(kind: HapticKind): void {
  if (!enabled) return
  if (!canPulse(kind)) return

  if (Capacitor.isNativePlatform()) {
    void capacitorPulse(kind)
    return
  }

  webVibrate(kind)
}
