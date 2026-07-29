import { getTelegramWebApp } from '@/lib/telegram'
import { loadSettings, saveSettings, type StoredSettings } from '@/utils/storage'

/** CloudStorage keys: only [A-Za-z0-9_-], 1–128 chars. */
const KEY_BEST = 'zen_bestScore'
const KEY_COMBO = 'zen_highCombo'

function getCloud() {
  const wa = getTelegramWebApp()
  if (!wa?.CloudStorage) return null
  // Prefer Mini App context; some clients expose CloudStorage only after ready().
  if (!wa.initData && !wa.initDataUnsafe?.user) return null
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

function cloudGetItems(
  cloud: NonNullable<ReturnType<typeof getCloud>>,
  keys: string[],
): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve({}), 4000)
    try {
      cloud.getItems(keys, (error, values) => {
        window.clearTimeout(timer)
        if (error || !values) resolve({})
        else resolve(values)
      })
    } catch {
      window.clearTimeout(timer)
      resolve({})
    }
  })
}

function cloudSetItem(
  cloud: NonNullable<ReturnType<typeof getCloud>>,
  key: string,
  value: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 4000)
    try {
      cloud.setItem(key, value, (error, stored) => {
        window.clearTimeout(timer)
        resolve(!error && stored !== false)
      })
    } catch {
      window.clearTimeout(timer)
      resolve(false)
    }
  })
}

/** Push local personal records to Telegram CloudStorage (no-op outside TG). */
export function pushRecordsToCloud(bestScore: number, highCombo: number): void {
  const cloud = getCloud()
  if (!cloud) return
  const best = String(Math.max(0, Math.floor(bestScore)))
  const combo = String(Math.max(1, Math.floor(highCombo)))
  void cloudSetItem(cloud, KEY_BEST, best)
  void cloudSetItem(cloud, KEY_COMBO, combo)
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
  if (!cloud) {
    return { bestScore: local.bestScore, highCombo: local.highCombo }
  }

  const remote = await cloudGetItems(cloud, [KEY_BEST, KEY_COMBO])
  const cloudBest = parseScore(remote[KEY_BEST], 0, 0)
  const cloudCombo = parseScore(remote[KEY_COMBO], 1, 1)

  const bestScore = Math.max(local.bestScore, cloudBest)
  const highCombo = Math.max(local.highCombo, cloudCombo)

  if (bestScore !== local.bestScore || highCombo !== local.highCombo) {
    saveSettings({ ...local, bestScore, highCombo })
  }

  // Always push merged max so the weaker device catches up.
  await Promise.all([
    cloudSetItem(cloud, KEY_BEST, String(bestScore)),
    cloudSetItem(cloud, KEY_COMBO, String(highCombo)),
  ])

  return { bestScore, highCombo }
}
