import { getTelegramWebApp } from '@/lib/telegram'
import { loadSettings, saveSettings, type StoredSettings } from '@/utils/storage'

/** CloudStorage keys: only [A-Za-z0-9_-], 1–128 chars. */
const KEY_RECORDS = 'zen_records'
const KEY_BEST = 'zen_b'
const KEY_COMBO = 'zen_c'
const LEGACY_BEST = 'zen_bestScore'
const LEGACY_COMBO = 'zen_highCombo'

const CACHE_KEY = 'zen.cloud.v1'
const CALL_TIMEOUT_MS = 4000

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

let inflightSync: Promise<
  Pick<StoredSettings, 'bestScore' | 'highCombo'> & { synced: boolean }
> | null = null

let inflightFlush: Promise<boolean> | null = null

function readCache(): CloudRecords | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const v = parsed as Record<string, unknown>
    const bestScore = asScore(v.bestScore, 0)
    const highCombo = asScore(v.highCombo, 1)
    if (bestScore == null) return null
    return { bestScore, highCombo: highCombo ?? 1 }
  } catch {
    return null
  }
}

function writeCache(records: CloudRecords): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        bestScore: records.bestScore,
        highCombo: records.highCombo,
      }),
    )
  } catch {
    // ignore
  }
}

function seedStatusFromCache(): void {
  if (!cloudSupported()) {
    lastStatus = { state: 'off' }
    return
  }
  const cached = readCache()
  const local = loadSettings()
  const bestScore = Math.max(cached?.bestScore ?? 0, local.bestScore)
  const highCombo = Math.max(cached?.highCombo ?? 1, local.highCombo)
  if (bestScore > 0 || (cached && cached.bestScore >= 0)) {
    lastStatus = { state: 'ok', bestScore, highCombo }
  }
}

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
  if (next.state === 'ok') writeCache(next)
  statusListeners.forEach((fn) => fn(next))
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
  return Boolean(wa.CloudStorage)
}

function asScore(value: unknown, min: number): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.floor(n))
}

function parseMaybeJson(raw: unknown): unknown {
  let cur: unknown = raw
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
    let settled = false
    const finish = (value: { ok: boolean; error?: string; result?: T }) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve(value)
    }
    const timer = window.setTimeout(() => {
      finish({ ok: false, error: 'timeout' })
    }, CALL_TIMEOUT_MS)
    try {
      run((err, res) => {
        if (isErrorValue(err)) {
          finish({ ok: false, error: String(err) })
        } else {
          finish({ ok: true, result: parseMaybeJson(res) as T })
        }
      })
    } catch (error) {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })
}

async function readCloudRecords(): Promise<
  { ok: true; records: CloudRecords | null } | { ok: false; error: string }
> {
  const cloud = getWebApp()?.CloudStorage
  if (!cloud) return { ok: false, error: 'no-cloud' }

  // Fast path: one key. Legacy keys only if the main blob is empty.
  const primary = await cloudCall<string>((cb) => {
    cloud.getItem(KEY_RECORDS, (error, value) => cb(error, value))
  })
  if (!primary.ok) return { ok: false, error: primary.error ?? 'read-failed' }

  const fromBlob = parseRecordsBlob(primary.result)
  if (fromBlob) return { ok: true, records: fromBlob }

  const legacy = await cloudCall<unknown>((cb) => {
    cloud.getItems(
      [KEY_BEST, KEY_COMBO, LEGACY_BEST, LEGACY_COMBO],
      (error, values) => cb(error, values),
    )
  })
  if (!legacy.ok) return { ok: true, records: null }

  let map = legacy.result
  if (typeof map === 'string') map = parseMaybeJson(map)
  if (!map || typeof map !== 'object') return { ok: true, records: null }

  const values = map as Record<string, unknown>
  const bestScore = Math.max(
    asScore(parseMaybeJson(values[KEY_BEST]), 0) ?? 0,
    asScore(parseMaybeJson(values[LEGACY_BEST]), 0) ?? 0,
  )
  const highCombo = Math.max(
    asScore(parseMaybeJson(values[KEY_COMBO]), 1) ?? 1,
    asScore(parseMaybeJson(values[LEGACY_COMBO]), 1) ?? 1,
  )

  if (bestScore <= 0 && highCombo <= 1) return { ok: true, records: null }
  return { ok: true, records: { bestScore, highCombo } }
}

async function writeCloudRecords(records: CloudRecords): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const cloud = getWebApp()?.CloudStorage
  if (!cloud) return { ok: false, error: 'no-cloud' }

  const best = Math.max(0, Math.floor(records.bestScore))
  const combo = Math.max(1, Math.floor(records.highCombo))
  const payload = JSON.stringify({ bestScore: best, highCombo: combo })

  const saved = await cloudCall<boolean>((cb) => {
    cloud.setItem(KEY_RECORDS, payload, (error, stored) => cb(error, stored))
  })
  if (!saved.ok || saved.result === false) {
    return { ok: false, error: saved.error ?? 'write-failed' }
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

function sameRecords(a: CloudRecords, b: CloudRecords | null | undefined): boolean {
  if (!b) return false
  return a.bestScore === b.bestScore && a.highCombo === b.highCombo
}

function markOk(records: CloudRecords): void {
  setStatus({
    state: 'ok',
    bestScore: records.bestScore,
    highCombo: records.highCombo,
  })
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
  if (inflightFlush) return inflightFlush

  inflightFlush = (async () => {
    // Optimistic: show the new score immediately while cloud catches up.
    markOk(
      mergeRecords(
        { bestScore, highCombo },
        lastStatus.state === 'ok' ? lastStatus : readCache(),
      ),
    )
    try {
      const remote = await readCloudRecords()
      const merged = remote.ok
        ? mergeRecords({ bestScore, highCombo }, remote.records)
        : { bestScore, highCombo }

      if (remote.ok && sameRecords(merged, remote.records)) {
        markOk(merged)
        return true
      }

      const written = await writeCloudRecords(merged)
      if (!written.ok) {
        setStatus({
          state: 'error',
          message: written.error ?? (remote.ok ? 'write-failed' : remote.error),
        })
        return false
      }
      markOk(merged)
      return true
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'flush-failed',
      })
      return false
    } finally {
      inflightFlush = null
    }
  })()

  return inflightFlush
}

/**
 * Pull cloud, merge with local (max wins), save both sides.
 * Skips write when cloud already has the merged values (big latency win).
 */
export async function syncRecordsWithCloud(): Promise<
  Pick<StoredSettings, 'bestScore' | 'highCombo'> & { synced: boolean }
> {
  const local = loadSettings()
  if (!cloudSupported()) {
    setStatus({ state: 'off' })
    return { bestScore: local.bestScore, highCombo: local.highCombo, synced: false }
  }
  if (inflightSync) return inflightSync

  // Instant UI from cache/local — never park on "sync…" if we already know a score.
  if (lastStatus.state !== 'ok') {
    const cached = readCache()
    const provisional = mergeRecords(
      { bestScore: local.bestScore, highCombo: local.highCombo },
      cached,
    )
    if (provisional.bestScore > 0) markOk(provisional)
  }

  inflightSync = (async () => {
    try {
      const freshLocal = loadSettings()
      const remote = await readCloudRecords()

      if (!remote.ok) {
        // Read can time out while write still works — try once, keep UI on cache.
        if (freshLocal.bestScore > 0 || freshLocal.highCombo > 1) {
          void writeCloudRecords({
            bestScore: freshLocal.bestScore,
            highCombo: freshLocal.highCombo,
          })
        }
        const fallback = mergeRecords(
          { bestScore: freshLocal.bestScore, highCombo: freshLocal.highCombo },
          lastStatus.state === 'ok' ? lastStatus : readCache(),
        )
        if (fallback.bestScore > 0 || lastStatus.state === 'ok') {
          markOk(fallback)
        } else {
          setStatus({ state: 'error', message: remote.error })
        }
        return {
          bestScore: fallback.bestScore,
          highCombo: fallback.highCombo,
          synced: false,
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

      // Already in sync — skip setItem (often the slow half of the wait).
      if (!sameRecords(merged, remote.records)) {
        const written = await writeCloudRecords(merged)
        if (!written.ok) {
          // Still apply merged locally; cloud write can retry later.
          markOk(merged)
          return { ...merged, synced: false }
        }
      }

      markOk(merged)
      return { ...merged, synced: true }
    } catch (error) {
      const fresh = loadSettings()
      if (lastStatus.state !== 'ok') {
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'sync-failed',
        })
      }
      return { bestScore: fresh.bestScore, highCombo: fresh.highCombo, synced: false }
    } finally {
      inflightSync = null
    }
  })()

  return inflightSync
}

/** Call as early as possible (before React) so the first paint can already show cloud. */
export function warmCloudSync(): void {
  seedStatusFromCache()
  if (!cloudSupported()) {
    setStatus({ state: 'off' })
    return
  }
  void syncRecordsWithCloud()
}

// Restore cached cloud label before first subscriber mounts.
seedStatusFromCache()
