export type GameMode = 'zen' | 'survival'

export interface ModeRecords {
  bestScore: number
  highCombo: number
}

export type ModeRecordsMap = Record<GameMode, ModeRecords>

export const GAME_MODES: readonly GameMode[] = ['zen', 'survival'] as const

export function emptyModeRecords(): ModeRecords {
  return { bestScore: 0, highCombo: 1 }
}

export function emptyModeRecordsMap(): ModeRecordsMap {
  return {
    zen: emptyModeRecords(),
    survival: emptyModeRecords(),
  }
}

export function isGameMode(value: unknown): value is GameMode {
  return value === 'zen' || value === 'survival'
}

export function modeLabel(mode: GameMode): string {
  return mode === 'zen' ? 'Zen' : 'Survival'
}
