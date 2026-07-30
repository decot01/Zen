import { flushRecordsToCloud } from '@/lib/cloudSync'

const STORAGE_KEY = 'zen.settings.v1'

export interface StoredSettings {
  bestScore: number
  highCombo: number
  muted: boolean
  haptics: boolean
}

const DEFAULTS: StoredSettings = {
  bestScore: 0,
  highCombo: 1,
  muted: false,
  haptics: true,
}

export function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS }
    const v = parsed as Record<string, unknown>
    return {
      bestScore:
        typeof v.bestScore === 'number' ? Math.max(0, Math.floor(v.bestScore)) : 0,
      highCombo:
        typeof v.highCombo === 'number' ? Math.max(1, Math.floor(v.highCombo)) : 1,
      muted: typeof v.muted === 'boolean' ? v.muted : false,
      haptics: typeof v.haptics === 'boolean' ? v.haptics : true,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Quota or private mode — ignore
  }
}

export function updateSettings(partial: Partial<StoredSettings>): StoredSettings {
  const next = { ...loadSettings(), ...partial }
  saveSettings(next)
  if (partial.bestScore !== undefined || partial.highCombo !== undefined) {
    void flushRecordsToCloud(next.bestScore, next.highCombo)
  }
  return next
}
