import { getTelegramWebApp } from '@/lib/telegram'
import { loadSettings, saveSettings, type StoredSettings } from '@/utils/storage'

/** CloudStorage keys: only [A-Za-z0-9_-], 1–128 chars. */
const KEY_RECORDS = 'zen_records'
/** Legacy keys from earlier sync attempts. */
const LEGACY_BEST = 'zen_bestScore'
const LEGACY_COMBO = 'zen_highCombo'

type CloudRecords = {
  bestScore: number
  highCombo: number
}

function getCloud() {
  const wa = getTelegramWebApp()
  if (!wa?.CloudStorage) return null
  if (typeof wa.isVersionAtLeast === 'function' && !wa.isVersionAtLeast('6.9')) {
    return null
  }
  const inTelegram = Boolean(wa.initData || wa.initDataUnsafe?.user?.id)
  if (!inTelegram) return null
  return wa.CloudStorage
}

function asScore(value: unknown, min: number): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.floor(n))
}

function parseRecords(raw: unknown): CloudRecords | null {
  if (raw == null || raw === '') return null

  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      const n = asScore(raw, 0)
      return n == null ? null : { bestScore: n, highCombo: 1 }
    }
  }

  if (!data || typeof data !== 'object') return null
  const v = data as Record<string, unknown>
  const bestScore = asScore(v.bestScore ?? v.b, 0)
  const highCombo = asScore(v.highCombo ?? v.c, 1)
  if (bestScore == null && highCombo == null) return null
  return {
    bestScore: bestScore ?? 0,
    highCombo: highCombo ?? 1,
  }
}

function normalizeGetResult(res: unknown): unknown {
  if (typeof res !== 'string') return res
  try {
    return JSON.parse(res)
  } catch {
    return res
  }
}

function cloudCall<T>(
  run: (callback: (err: unknown, res?: T) => void) => void,
): Promise<{ ok: boolean; error?: unknown; result?: T }> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      resolve({ ok: false, error: 'timeout' })
    }, 5000)
    try {
      run((err, res) => {
        window.clearTimeout(timer)
        if (err) resolve({ ok: false, error: err })
        else resolve({ ok: true, result: res })
      })
    } catch (error) {
      window.clearTimeout(timer)
      resolve({ ok: false, error })
    }
  })
}

async function getRawItem(key: string): Promise<unknown> {
  const cloud = getCloud()
  if (!cloud) return null
  const res = await cloudCall<unknown>((cb) => {
    cloud.getItem(key, cb)
  })
  if (!res.ok) return null
  return normalizeGetResult(res.result)
}

async function readCloudRecords(): Promise<CloudRecords | null> {
  const cloud = getCloud()
  if (!cloud) return null

  const fromMain = parseRecords(await getRawItem(KEY_RECORDS))
  const legacyBest = asScore(await getRawItem(LEGACY_BEST), 0)
  const legacyCombo = asScore(await getRawItem(LEGACY_COMBO), 1)

  const bestScore = Math.max(fromMain?.bestScore ?? 0, legacyBest ?? 0)
  const highCombo = Math.max(fromMain?.highCombo ?? 1, legacyCombo ?? 1)

  if (!fromMain && legacyBest == null && legacyCombo == null) return null
  return { bestScore, highCombo }
}

async function writeCloudRecords(records: CloudRecords): Promise<boolean> {
  const cloud = getCloud()
  if (!cloud) return false

  const payload = JSON.stringify({
    bestScore: Math.max(0, Math.floor(records.bestScore)),
    highCombo: Math.max(1, Math.floor(records.highCombo)),
  })

  const saved = await cloudCall<boolean>((cb) => {
    cloud.setItem(KEY_RECORDS, payload, cb)
  })
  return saved.ok && saved.result !== false
}

/** Upload current local records immediately (no new high score needed). */
export async function uploadLocalRecordsToCloud(): Promise<boolean> {
  const local = loadSettings()
  if (local.bestScore <= 0 && local.highCombo <= 1) return false
  return writeCloudRecords({
    bestScore: local.bestScore,
    highCombo: local.highCombo,
  })
}

/** Push local personal records to Telegram CloudStorage (no-op outside TG). */
export function pushRecordsToCloud(bestScore: number, highCombo: number): void {
  void writeCloudRecords({ bestScore, highCombo })
}

/**
 * 1) Upload existing local best (so old records leave the device)
 * 2) Pull cloud / legacy keys
 * 3) Keep max, save locally, write back to cloud
 */
export async function syncRecordsWithCloud(): Promise<
  Pick<StoredSettings, 'bestScore' | 'highCombo'> & { synced: boolean }
> {
  const local = loadSettings()
  const cloud = getCloud()
  if (!cloud) {
    return { bestScore: local.bestScore, highCombo: local.highCombo, synced: false }
  }

  // Always seed cloud from whatever is already on this phone.
  if (local.bestScore > 0 || local.highCombo > 1) {
    await writeCloudRecords({
      bestScore: local.bestScore,
      highCombo: local.highCombo,
    })
  }

  const remote = await readCloudRecords()
  const bestScore = Math.max(local.bestScore, remote?.bestScore ?? 0)
  const highCombo = Math.max(local.highCombo, remote?.highCombo ?? 1)

  if (bestScore !== local.bestScore || highCombo !== local.highCombo) {
    saveSettings({ ...local, bestScore, highCombo })
  }

  const synced = await writeCloudRecords({ bestScore, highCombo })
  return { bestScore, highCombo, synced }
}
