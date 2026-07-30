import { getTelegramWebApp } from '@/lib/telegram'
import { loadSettings, saveSettings, type StoredSettings } from '@/utils/storage'

/** CloudStorage keys: only [A-Za-z0-9_-], 1–128 chars. */
const KEY_BEST = 'zen_b'
const KEY_COMBO = 'zen_c'
const KEY_RECORDS = 'zen_records'
const LEGACY_BEST = 'zen_bestScore'
const LEGACY_COMBO = 'zen_highCombo'

const ALL_KEYS = [KEY_BEST, KEY_COMBO, KEY_RECORDS, LEGACY_BEST, LEGACY_COMBO]

type CloudRecords = {
  bestScore: number
  highCombo: number
}

export type SyncStatus =
  | { state: 'off' }
  | { state: 'syncing' }
  | { state: 'ok'; bestScore: number; highCombo: number }
  | { state: 'error'; message: string }

let lastStatus: SyncStatus = { state: 'off' }
const statusListeners = new Set<(s: SyncStatus) => void>()

export function getSyncStatus(): SyncStatus {
  return lastStatus
}

export function subscribeSyncStatus(listener: (s: SyncStatus) => void): () => void {
  statusListeners.add(listener)
  listener(lastStatus)
  return () => {
    statusListeners.delete(listener)
  }
}

function setStatus(next: SyncStatus): void {
  lastStatus = next
  statusListeners.forEach((fn) => fn(next))
}

/** Serialize cloud ops — concurrent writes race and drop higher scores. */
let cloudQueue: Promise<unknown> = Promise.resolve()

function enqueueCloud<T>(task: () => Promise<T>): Promise<T> {
  const next = cloudQueue.then(task, task)
  cloudQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

function getWebApp() {
  return getTelegramWebApp()
}

function isTelegramSession(): boolean {
  const wa = getWebApp()
  return Boolean(wa && (wa.initData || wa.initDataUnsafe?.user?.id))
}

function cloudSupported(): boolean {
  const wa = getWebApp()
  if (!wa || !isTelegramSession()) return false
  if (typeof wa.isVersionAtLeast === 'function' && !wa.isVersionAtLeast('6.9')) {
    return false
  }
  return Boolean(wa.CloudStorage || wa.invokeCustomMethod)
}

function asScore(value: unknown, min: number): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.floor(n))
}

function parseMaybeJson(raw: unknown): unknown {
  let cur: unknown = raw
  // Native clients often return JSON text; sometimes double-encoded.
  for (let i = 0; i < 2; i++) {
    if (typeof cur !== 'string') break
    const trimmed = cur.trim()
    if (!trimmed) return ''
    try {
      cur = JSON.parse(trimmed)
    } catch {
      return cur
    }
  }
  return cur
}

function parseRecordsBlob(raw: unknown): CloudRecords | null {
  const data = parseMaybeJson(raw)
  if (data == null || data === '') return null
  if (typeof data === 'number') {
    return { bestScore: Math.max(0, Math.floor(data)), highCombo: 1 }
  }
  if (typeof data === 'string') {
    const n = asScore(data, 0)
    return n == null ? null : { bestScore: n, highCombo: 1 }
  }
  if (typeof data !== 'object') return null
  const v = data as Record<string, unknown>
  const bestScore = asScore(v.bestScore ?? v.b, 0)
  const highCombo = asScore(v.highCombo ?? v.c, 1)
  if (bestScore == null && highCombo == null) return null
  return {
    bestScore: bestScore ?? 0,
    highCombo: highCombo ?? 1,
  }
}

function isErrorValue(err: unknown): boolean {
  if (err == null || err === false || err === '') return false
  if (typeof err === 'string' && err.toLowerCase() === 'null') return false
  return true
}

function cloudCall<T>(
  run: (callback: (err: unknown, res?: T) => void) => void,
): Promise<{ ok: boolean; error?: string; result?: T }> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      resolve({ ok: false, error: 'timeout' })
    }, 12000)
    try {
      run((err, res) => {
        window.clearTimeout(timer)
        if (isErrorValue(err)) {
          resolve({ ok: false, error: String(err) })
        } else {
          resolve({ ok: true, result: parseMaybeJson(res) as T })
        }
      })
    } catch (error) {
      window.clearTimeout(timer)
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })
}

async function invokeStorage<T>(
  method: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; result?: T }> {
  const wa = getWebApp()
  if (!wa) return { ok: false, error: 'no-webapp' }

  if (typeof wa.invokeCustomMethod === 'function') {
    return cloudCall<T>((cb) => {
      wa.invokeCustomMethod!(method, params, (error, result) => {
        cb(error, result as T | undefined)
      })
    })
  }

  const cloud = wa.CloudStorage
  if (!cloud) return { ok: false, error: 'no-cloud' }

  if (method === 'saveStorageValue') {
    return cloudCall<T>((cb) => {
      cloud.setItem(String(params.key), String(params.value), (error, stored) => {
        cb(error, stored as T | undefined)
      })
    })
  }
  if (method === 'getStorageValues') {
    return cloudCall<T>((cb) => {
      cloud.getItems(params.keys as string[], (error, values) => {
        cb(error, values as T | undefined)
      })
    })
  }
  return { ok: false, error: `unsupported:${method}` }
}

async function readCloudRecords(): Promise<
  { ok: true; records: CloudRecords | null } | { ok: false; error: string }
> {
  const res = await invokeStorage<unknown>('getStorageValues', { keys: ALL_KEYS })
  if (!res.ok) return { ok: false, error: res.error ?? 'read-failed' }

  let map = res.result
  if (typeof map === 'string') map = parseMaybeJson(map)
  if (!map || typeof map !== 'object') {
    return { ok: true, records: null }
  }

  const values = map as Record<string, unknown>
  const fromBlob = parseRecordsBlob(values[KEY_RECORDS])
  const bestScore = Math.max(
    fromBlob?.bestScore ?? 0,
    asScore(parseMaybeJson(values[KEY_BEST]), 0) ?? 0,
    asScore(parseMaybeJson(values[LEGACY_BEST]), 0) ?? 0,
  )
  const highCombo = Math.max(
    fromBlob?.highCombo ?? 1,
    asScore(parseMaybeJson(values[KEY_COMBO]), 1) ?? 1,
    asScore(parseMaybeJson(values[LEGACY_COMBO]), 1) ?? 1,
  )

  const any =
    fromBlob != null ||
    values[KEY_BEST] != null && values[KEY_BEST] !== '' ||
    values[LEGACY_BEST] != null && values[LEGACY_BEST] !== '' ||
    values[KEY_COMBO] != null && values[KEY_COMBO] !== '' ||
    values[LEGACY_COMBO] != null && values[LEGACY_COMBO] !== ''

  if (!any) return { ok: true, records: null }
  return { ok: true, records: { bestScore, highCombo } }
}

async function writeCloudRecords(records: CloudRecords): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const best = Math.max(0, Math.floor(records.bestScore))
  const combo = Math.max(1, Math.floor(records.highCombo))
  const blob = JSON.stringify({ bestScore: best, highCombo: combo })

  // Plain numeric keys first — simplest path for picky clients.
  // Sequential: Telegram's custom-method bridge is not concurrency-safe.
  for (const [key, value] of [
    [KEY_BEST, String(best)],
    [KEY_COMBO, String(combo)],
    [KEY_RECORDS, blob],
  ] as const) {
    const written = await invokeStorage('saveStorageValue', { key, value })
    if (!written.ok) return { ok: false, error: written.error ?? 'write-failed' }
  }

  // Verify at least the plain best key stuck.
  const check = await invokeStorage<unknown>('getStorageValues', { keys: [KEY_BEST] })
  if (!check.ok) return { ok: false, error: check.error ?? 'verify-failed' }
  let map = check.result
  if (typeof map === 'string') map = parseMaybeJson(map)
  const got =
    map && typeof map === 'object'
      ? asScore(parseMaybeJson((map as Record<string, unknown>)[KEY_BEST]), 0)
      : null
  if (got == null || got < best) {
    return { ok: false, error: `verify-mismatch:${got}` }
  }
  return { ok: true }
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

/** Push local personal records (read→merge→write). */
export function pushRecordsToCloud(bestScore: number, highCombo: number): void {
  void flushRecordsToCloud(bestScore, highCombo)
}

/** Awaitable push — use after a new best so the write finishes before close. */
export async function flushRecordsToCloud(
  bestScore: number,
  highCombo: number,
): Promise<boolean> {
  if (!cloudSupported()) {
    setStatus({ state: 'off' })
    return false
  }

  return enqueueCloud(async () => {
    setStatus({ state: 'syncing' })
    const remote = await readCloudRecords()
    if (!remote.ok) {
      // Still try writing local — better than losing a new PC record.
      const written = await writeCloudRecords({ bestScore, highCombo })
      if (!written.ok) {
        setStatus({ state: 'error', message: remote.error })
        return false
      }
      setStatus({ state: 'ok', bestScore, highCombo })
      return true
    }

    const merged = mergeRecords({ bestScore, highCombo }, remote.records)
    const written = await writeCloudRecords(merged)
    if (!written.ok) {
      setStatus({ state: 'error', message: written.error })
      return false
    }
    setStatus({ state: 'ok', bestScore: merged.bestScore, highCombo: merged.highCombo })
    return true
  })
}

/**
 * Pull cloud, merge with local (max wins), save both sides.
 * Read always happens before write.
 */
export async function syncRecordsWithCloud(): Promise<
  Pick<StoredSettings, 'bestScore' | 'highCombo'> & { synced: boolean }
> {
  const local = loadSettings()
  if (!cloudSupported()) {
    setStatus({ state: 'off' })
    return { bestScore: local.bestScore, highCombo: local.highCombo, synced: false }
  }

  return enqueueCloud(async () => {
    setStatus({ state: 'syncing' })
    const freshLocal = loadSettings()

    const remote = await readCloudRecords()
    if (!remote.ok) {
      const written = await writeCloudRecords({
        bestScore: freshLocal.bestScore,
        highCombo: freshLocal.highCombo,
      })
      if (!written.ok) {
        setStatus({ state: 'error', message: remote.error })
        return {
          bestScore: freshLocal.bestScore,
          highCombo: freshLocal.highCombo,
          synced: false,
        }
      }
      setStatus({
        state: 'ok',
        bestScore: freshLocal.bestScore,
        highCombo: freshLocal.highCombo,
      })
      return {
        bestScore: freshLocal.bestScore,
        highCombo: freshLocal.highCombo,
        synced: true,
      }
    }

    const merged = mergeRecords(
      { bestScore: freshLocal.bestScore, highCombo: freshLocal.highCombo },
      remote.records,
    )

    if (
      merged.bestScore !== freshLocal.bestScore ||
      merged.highCombo !== freshLocal.highCombo
    ) {
      saveSettings({ ...freshLocal, ...merged })
    }

    const written = await writeCloudRecords(merged)
    if (!written.ok) {
      setStatus({ state: 'error', message: written.error })
      return { ...merged, synced: false }
    }

    setStatus({
      state: 'ok',
      bestScore: merged.bestScore,
      highCombo: merged.highCombo,
    })
    return { ...merged, synced: true }
  })
}
