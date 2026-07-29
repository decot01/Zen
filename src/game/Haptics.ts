import {
  isHapticsEnabled,
  isHapticsSupported,
  pulseHaptic,
  setHapticsEnabled,
  type HapticKind,
} from '@/lib/feel'

export type { HapticKind }

/**
 * Gameplay haptics — thin wrapper over shared feel module
 * so UI buttons and the game loop share one enable flag.
 */
export class Haptics {
  setEnabled(enabled: boolean): void {
    setHapticsEnabled(enabled)
  }

  isEnabled(): boolean {
    return isHapticsEnabled()
  }

  isSupported(): boolean {
    return isHapticsSupported()
  }

  pulse(kind: HapticKind): void {
    pulseHaptic(kind)
  }
}
