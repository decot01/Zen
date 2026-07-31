import type { ModeRecords, ModeRecordsMap } from '@/game/mode'
import { emptyModeRecordsMap } from '@/game/mode'
import { getTelegramWebApp } from '@/lib/telegram'
import { loadSettings, saveSettings } from '@/utils/storage'

/** CloudStorage keys: only [A-Za-z0-9_-], 1–128 chars. */
const KEY_RECORDS = 'zen_records'
const KEY_BEST = 'zen_b'
const KEY_COMBO = 'zen_c'
const LEGACY_BEST = 'zen_bestScore'
const LEGACY_COMBO = 'zen_highCombo'

const CACHE_KEY = 'zen.cloud.v1'
const CALL_TIMEOUT_MS = 4000

type CloudRecords = ModeRecords
type CloudBundle = ModeRecordsMap

export type SyncStatus =
  | { state: 'off' }
  | { state: 'syncing' }
  | { state: 'ok'; records: CloudBundle }
  | { state: 'error'; message: string }

let lastStatus: SyncStatus = { state: 'off' }
const statusListeners = new Set<(s: SyncStatus) => void>()

let inflightSync: Promise<CloudBundle & { synced: boolean }> | null = null
let inflightFlush: Promise<boolean> | null = null

function readCache(): CloudBundle | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return parseCloudBundle(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeCache(records: CloudBundle): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(records))
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
  const local = loadSettings().records
  const merged = mergeBundles(local, cached)
  if (hasAnyScore(merged) || cached) {
    lastStatus = { state: 'ok', records: merged }
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
  if (next.state === 'ok') writeCache(next.records)
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

function hasAnyScore(bundle: CloudBundle): boolean {
  return (
    bundle.zen.bestScore > 0 ||
    bundle.zen.highCombo > 1 ||
    bundle.survival.bestScore > 0 ||
    bundle.survival.highCombo > 1
  )
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

function parseFlatRecords(raw: unknown): CloudRecords | null {
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

/** v2 nested modes, or legacy flat blob → survival. */
function parseCloudBundle(raw: unknown): CloudBundle | null {
  const data = parseMaybeJson(raw)
  if (data == null || data === '' || typeof data !== 'object') return null
  const v = data as Record<string, unknown>

  if (v.zen != null || v.survival != null) {
    const bundle = emptyModeRecordsMap()
    const zen = parseFlatRecords(v.zen)
    const survival = parseFlatRecords(v.survival)
    if (zen) bundle.zen = zen
    if (survival) bundle.survival = survival
    return bundle
  }

  const flat = parseFlatRecords(data)
  if (!flat) return null
  const bundle = emptyModeRecordsMap()
  bundle.survival = flat
  return bundle
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
  { ok: true; records: CloudBundle | null } | { ok: false; error: string }
> {
  const cloud = getWebApp()?.CloudStorage
  if (!cloud) return { ok: false, error: 'no-cloud' }

  const primary = await cloudCall<string>((cb) => {
    cloud.getItem(KEY_RECORDS, (error, value) => cb(error, value))
  })
  if (!primary.ok) return { ok: false, error: primary.error ?? 'read-failed' }

  const fromBlob = parseCloudBundle(primary.result)
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
  const bundle = emptyModeRecordsMap()
  bundle.survival = { bestScore, highCombo }
  return { ok: true, records: bundle }
}

async function writeCloudRecords(records: CloudBundle): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const cloud = getWebApp()?.CloudStorage
  if (!cloud) return { ok: false, error: 'no-cloud' }

  const payload = JSON.stringify({
    v: 2,
    zen: {
      bestScore: Math.max(0, Math.floor(records.zen.bestScore)),
      highCombo: Math.max(1, Math.floor(records.zen.highCombo)),
    },
    survival: {
      bestScore: Math.max(0, Math.floor(records.survival.bestScore)),
      highCombo: Math.max(1, Math.floor(records.survival.highCombo)),
    },
  })

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

function mergeBundles(
  a: CloudBundle,
  b: CloudBundle | null | undefined,
): CloudBundle {
  return {
    zen: mergeRecords(a.zen, b?.zen),
    survival: mergeRecords(a.survival, b?.survival),
  }
}

function sameBundles(a: CloudBundle, b: CloudBundle | null | undefined): boolean {
  if (!b) return false
  return (
    a.zen.bestScore === b.zen.bestScore &&
    a.zen.highCombo === b.zen.highCombo &&
    a.survival.bestScore === b.survival.bestScore &&
    a.survival.highCombo === b.survival.highCombo
  )
}

function markOk(records: CloudBundle): void {
  setStatus({ state: 'ok', records })
}

/** Push local personal records (read→merge→write). */
export function pushRecordsToCloud(records: CloudBundle): void {
  void flushRecordsToCloud(records)
}

/** Awaitable push — use after a new best so the write finishes before close. */
export async function flushRecordsToCloud(
  records: CloudBundle,
): Promise<boolean> {
  if (!cloudSupported()) {
    setStatus({ state: 'off' })
    return false
  }
  if (inflightFlush) return inflightFlush

  inflightFlush = (async () => {
    markOk(
      mergeBundles(
        records,
        lastStatus.state === 'ok' ? lastStatus.records : readCache(),
      ),
    )
    try {
      const remote = await readCloudRecords()
      const merged = remote.ok
        ? mergeBundles(records, remote.records)
        : records

      if (remote.ok && sameBundles(merged, remote.records)) {
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
 * Pull cloud, merge with local (max wins per mode), save both sides.
 */
export async function syncRecordsWithCloud(): Promise<
  CloudBundle & { synced: boolean }
> {
  const local = loadSettings().records
  if (!cloudSupported()) {
    setStatus({ state: 'off' })
    return { ...local, synced: false }
  }
  if (inflightSync) return inflightSync

  if (lastStatus.state !== 'ok') {
    const cached = readCache()
    const provisional = mergeBundles(local, cached)
    if (hasAnyScore(provisional)) markOk(provisional)
  }

  inflightSync = (async () => {
    try {
      const freshLocal = loadSettings()
      const remote = await readCloudRecords()

      if (!remote.ok) {
        if (hasAnyScore(freshLocal.records)) {
          void writeCloudRecords(freshLocal.records)
        }
        const fallback = mergeBundles(
          freshLocal.records,
          lastStatus.state === 'ok' ? lastStatus.records : readCache(),
        )
        if (hasAnyScore(fallback) || lastStatus.state === 'ok') {
          markOk(fallback)
        } else {
          setStatus({ state: 'error', message: remote.error })
        }
        return { ...fallback, synced: false }
      }

      const merged = mergeBundles(freshLocal.records, remote.records)

      if (!sameBundles(merged, freshLocal.records)) {
        saveSettings({ ...freshLocal, records: merged })
      }

      if (!sameBundles(merged, remote.records)) {
        const written = await writeCloudRecords(merged)
        if (!written.ok) {
          markOk(merged)
          return { ...merged, synced: false }
        }
      }

      markOk(merged)
      return { ...merged, synced: true }
    } catch (error) {
      const fresh = loadSettings().records
      if (lastStatus.state !== 'ok') {
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'sync-failed',
        })
      }
      return { ...fresh, synced: false }
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
