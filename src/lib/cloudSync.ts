import { getTelegramWebApp, isTelegramMiniApp } from '@/lib/telegram'
import { loadSettings, saveSettings, type StoredSettings } from '@/utils/storage'

const KEY_BEST = 'zen.bestScore'
const KEY_COMBO = 'zen.highCombo'

function getCloud() {
  const wa = getTelegramWebApp()
  if (!wa?.initData || !wa.CloudStorage) return null
  if (typeof wa.isVersionAtLeast === 'function' && !wa.isVersionAtLeast('6.9')) {
    return null
  }
  return wa.CloudStorage
}

function parseScore(raw: string | undefined, fallback: number, min = 0): number {
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.floor(n))
}

/** Push local personal records to Telegram CloudStorage (no-op outside TG). */
export function pushRecordsToCloud(bestScore: number, highCombo: number): void {
  const cloud = getCloud()
  if (!cloud) return
  try {
    cloud.setItem(KEY_BEST, String(Math.max(0, Math.floor(bestScore))))
    cloud.setItem(KEY_COMBO, String(Math.max(1, Math.floor(highCombo))))
  } catch {
    // Older clients / quota
  }
}

/**
 * Pull cloud records, merge with localStorage (keep max), write both ways.
 * Returns merged score fields.
 */
export async function syncRecordsWithCloud(): Promise<
  Pick<StoredSettings, 'bestScore' | 'highCombo'>
> {
  const local = loadSettings()
  const cloud = getCloud()
  if (!cloud || !isTelegramMiniApp()) {
    return { bestScore: local.bestScore, highCombo: local.highCombo }
  }

  const remote = await new Promise<Record<string, string>>((resolve) => {
    try {
      cloud.getItems([KEY_BEST, KEY_COMBO], (error, values) => {
        if (error || !values) resolve({})
        else resolve(values)
      })
    } catch {
      resolve({})
    }
  })

  const cloudBest = parseScore(remote[KEY_BEST], 0, 0)
  const cloudCombo = parseScore(remote[KEY_COMBO], 1, 1)

  const bestScore = Math.max(local.bestScore, cloudBest)
  const highCombo = Math.max(local.highCombo, cloudCombo)

  if (bestScore !== local.bestScore || highCombo !== local.highCombo) {
    saveSettings({ ...local, bestScore, highCombo })
  }

  // Always push merged max so the weaker device catches up.
  pushRecordsToCloud(bestScore, highCombo)

  return { bestScore, highCombo }
}
