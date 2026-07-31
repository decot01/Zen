import {
  emptyModeRecords,
  emptyModeRecordsMap,
  isGameMode,
  type GameMode,
  type ModeRecords,
  type ModeRecordsMap,
} from '@/game/mode'

const STORAGE_KEY = 'zen.settings.v1'

export interface StoredSettings {
  mode: GameMode
  records: ModeRecordsMap
  muted: boolean
  haptics: boolean
}

const DEFAULTS: StoredSettings = {
  mode: 'survival',
  records: emptyModeRecordsMap(),
  muted: false,
  haptics: true,
}

function sanitizeRecords(raw: unknown): ModeRecords {
  if (!raw || typeof raw !== 'object') return emptyModeRecords()
  const v = raw as Record<string, unknown>
  return {
    bestScore:
      typeof v.bestScore === 'number' ? Math.max(0, Math.floor(v.bestScore)) : 0,
    highCombo:
      typeof v.highCombo === 'number' ? Math.max(1, Math.floor(v.highCombo)) : 1,
  }
}

function sanitizeRecordsMap(raw: unknown, legacy?: ModeRecords): ModeRecordsMap {
  const base = emptyModeRecordsMap()
  if (raw && typeof raw === 'object') {
    const v = raw as Record<string, unknown>
    base.zen = sanitizeRecords(v.zen)
    base.survival = sanitizeRecords(v.survival)
  }
  // Pre-mode saves lived in a world with events → Survival.
  if (legacy && (legacy.bestScore > 0 || legacy.highCombo > 1)) {
    base.survival = {
      bestScore: Math.max(base.survival.bestScore, legacy.bestScore),
      highCombo: Math.max(base.survival.highCombo, legacy.highCombo),
    }
  }
  return base
}

export function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {
      mode: DEFAULTS.mode,
      records: emptyModeRecordsMap(),
      muted: DEFAULTS.muted,
      haptics: DEFAULTS.haptics,
    }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return {
        mode: DEFAULTS.mode,
        records: emptyModeRecordsMap(),
        muted: DEFAULTS.muted,
        haptics: DEFAULTS.haptics,
      }
    }
    const v = parsed as Record<string, unknown>
    const legacyFlat =
      typeof v.bestScore === 'number' || typeof v.highCombo === 'number'
        ? {
            bestScore:
              typeof v.bestScore === 'number'
                ? Math.max(0, Math.floor(v.bestScore))
                : 0,
            highCombo:
              typeof v.highCombo === 'number'
                ? Math.max(1, Math.floor(v.highCombo))
                : 1,
          }
        : undefined

    return {
      mode: isGameMode(v.mode) ? v.mode : DEFAULTS.mode,
      records: sanitizeRecordsMap(v.records, legacyFlat),
      muted: typeof v.muted === 'boolean' ? v.muted : false,
      haptics: typeof v.haptics === 'boolean' ? v.haptics : true,
    }
  } catch {
    return {
      mode: DEFAULTS.mode,
      records: emptyModeRecordsMap(),
      muted: DEFAULTS.muted,
      haptics: DEFAULTS.haptics,
    }
  }
}

export function saveSettings(settings: StoredSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Quota or private mode — ignore
  }
}

export function updateSettings(
  partial: Partial<Omit<StoredSettings, 'records'>> & {
    records?: ModeRecordsMap
  },
): StoredSettings {
  const prev = loadSettings()
  const next: StoredSettings = {
    ...prev,
    ...partial,
    records: partial.records ?? prev.records,
  }
  saveSettings(next)
  return next
}

export function updateModeRecords(
  mode: GameMode,
  partial: Partial<ModeRecords>,
): StoredSettings {
  const prev = loadSettings()
  const nextRecords: ModeRecordsMap = {
    ...prev.records,
    [mode]: {
      ...prev.records[mode],
      ...partial,
    },
  }
  return updateSettings({ records: nextRecords })
}
