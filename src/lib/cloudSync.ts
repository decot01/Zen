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

/** Serialize all cloud ops — concurrent setItem races overwrite higher scores. */
let cloudQueue: Promise<unknown> = Promise.resolve()

function enqueueCloud<T>(task: () => Promise<T>): Promise<T> {
  const next = cloudQueue.then(task, task)
  cloudQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
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

async function readCloudRecords(): Promise<CloudRecords | null> {
  const cloud = getCloud()
  if (!cloud) return null

  const res = await cloudCall<unknown>((cb) => {
    cloud.getItems([KEY_RECORDS, LEGACY_BEST, LEGACY_COMBO], cb)
  })
  if (!res.ok) return null

  let values = normalizeGetResult(res.result)
  if (typeof values === 'string') {
    try {
      values = JSON.parse(values)
    } catch {
      return null
    }
  }
  if (!values || typeof values !== 'object') return null

  const map = values as Record<string, unknown>
  const fromMain = parseRecords(normalizeGetResult(map[KEY_RECORDS]))
  const legacyBest = asScore(normalizeGetResult(map[LEGACY_BEST]), 0)
  const legacyCombo = asScore(normalizeGetResult(map[LEGACY_COMBO]), 1)

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

function mergeRecords(
  a: CloudRecords,
  b: CloudRecords | null | undefined,
): CloudRecords {
  return {
    bestScore: Math.max(a.bestScore, b?.bestScore ?? 0),
    highCombo: Math.max(a.highCombo, b?.highCombo ?? 1),
  }
}

/**
 * Push local personal records to Telegram CloudStorage.
 * Always read→merge→write so a lower local score never clobbers cloud.
 */
export function pushRecordsToCloud(bestScore: number, highCombo: number): void {
  void enqueueCloud(async () => {
    const remote = await readCloudRecords()
    const merged = mergeRecords({ bestScore, highCombo }, remote)
    await writeCloudRecords(merged)
  })
}

/**
 * Pull cloud, merge with local (max wins), save both sides.
 * Never write local before reading — that overwrote higher cloud scores.
 */
export async function syncRecordsWithCloud(): Promise<
  Pick<StoredSettings, 'bestScore' | 'highCombo'> & { synced: boolean }
> {
  return enqueueCloud(async () => {
    const local = loadSettings()
    const cloud = getCloud()
    if (!cloud) {
      return { bestScore: local.bestScore, highCombo: local.highCombo, synced: false }
    }

    const remote = await readCloudRecords()
    const merged = mergeRecords(
      { bestScore: local.bestScore, highCombo: local.highCombo },
      remote,
    )

    if (
      merged.bestScore !== local.bestScore ||
      merged.highCombo !== local.highCombo
    ) {
      saveSettings({ ...local, ...merged })
    }

    // Still write when local is ahead or equal — seeds empty cloud with old records.
    const synced = await writeCloudRecords(merged)
    return { ...merged, synced }
  })
}
