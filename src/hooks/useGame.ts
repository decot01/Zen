import { LOOP } from '@/game/constants'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Game, type GameSnapshot } from '@/game/Game'
import type { GameMode } from '@/game/mode'
import { flushRecordsToCloud, syncRecordsWithCloud } from '@/lib/cloudSync'
import {
  getTelegramWebApp,
  requestTelegramFullscreen,
  syncTelegramSafeArea,
} from '@/lib/telegram'
import { lockPortraitOrientation } from '@/lib/orientation'
import { loadSettings } from '@/utils/storage'

const settings = loadSettings()

const INITIAL: GameSnapshot = {
  phase: 'menu',
  mode: settings.mode,
  score: 0,
  bestScore: settings.records[settings.mode].bestScore,
  combo: 1,
  highCombo: settings.records[settings.mode].highCombo,
  runMaxCombo: 1,
  elapsed: 0,
  muted: settings.muted,
  haptics: settings.haptics,
  isNewBest: false,
  dying: false,
  activeEvent: null,
}

function snapshotsEqual(a: GameSnapshot, b: GameSnapshot): boolean {
  return (
    a.phase === b.phase &&
    a.mode === b.mode &&
    a.score === b.score &&
    a.bestScore === b.bestScore &&
    a.combo === b.combo &&
    a.highCombo === b.highCombo &&
    a.runMaxCombo === b.runMaxCombo &&
    Math.floor(a.elapsed) === Math.floor(b.elapsed) &&
    a.muted === b.muted &&
    a.haptics === b.haptics &&
    a.isNewBest === b.isNewBest &&
    a.dying === b.dying &&
    a.activeEvent === b.activeEvent
  )
}

/**
 * Bridges the imperative Game loop to React.
 * Canvas rendering stays outside React state; only UI snapshots update.
 */
export function useGame() {
  const gameRef = useRef<Game | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL)

  if (!gameRef.current) {
    gameRef.current = new Game()
  }
  const game = gameRef.current

  useEffect(() => {
    game.setListener((next) => {
      setSnapshot((prev) => (snapshotsEqual(prev, next) ? prev : next))
    })
    return () => game.setListener(null)
  }, [game])

  // Pull Telegram CloudStorage records and merge with local bests.
  useEffect(() => {
    let cancelled = false

    const apply = async () => {
      const records = await syncRecordsWithCloud()
      if (cancelled) return
      const { synced: _synced, ...bundle } = records
      game.applySyncedRecords(bundle)
    }

    void apply()
    const retry = window.setTimeout(() => {
      void apply()
    }, 1500)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void apply()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearTimeout(retry)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [game])

  // Re-flush after a run so a new PC best is not lost if the first write raced.
  useEffect(() => {
    if (snapshot.phase !== 'gameover') return
    let cancelled = false
    void (async () => {
      const local = loadSettings().records
      const ok = await flushRecordsToCloud(local)
      if (cancelled || ok) return
      const records = await syncRecordsWithCloud()
      if (!cancelled) {
        const { synced: _synced, ...bundle } = records
        game.applySyncedRecords(bundle)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [game, snapshot.phase, snapshot.mode, snapshot.bestScore, snapshot.highCombo])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    game.attachCanvas(canvas)
    game.startLoop()

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const raw = window.devicePixelRatio || 1
      // Cap DPR for high-refresh / high-DPI fill-rate (120 Hz phones).
      const dpr = Math.min(raw, LOOP.maxDpr)
      game.resize(rect.width, rect.height, dpr)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    const wa = getTelegramWebApp()
    const onViewport = () => {
      syncTelegramSafeArea()
      resize()
    }
    wa?.onEvent?.('viewportChanged', onViewport)
    wa?.onEvent?.('safeAreaChanged', onViewport)
    wa?.onEvent?.('contentSafeAreaChanged', onViewport)
    wa?.onEvent?.('fullscreenChanged', onViewport)
    window.addEventListener('resize', resize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      wa?.offEvent?.('viewportChanged', onViewport)
      wa?.offEvent?.('safeAreaChanged', onViewport)
      wa?.offEvent?.('contentSafeAreaChanged', onViewport)
      wa?.offEvent?.('fullscreenChanged', onViewport)
      game.stopLoop()
    }
  }, [game])

  // Auto-pause when the tab/app goes to background (switch tab, lock phone, etc.)
  useEffect(() => {
    const autoPause = () => game.pause()

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') autoPause()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', autoPause)
    window.addEventListener('blur', autoPause)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', autoPause)
      window.removeEventListener('blur', autoPause)
    }
  }, [game])

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (snapshot.phase !== 'playing') return
      e.currentTarget.setPointerCapture(e.pointerId)
      const { x, y } = toLocal(e.clientX, e.clientY)
      game.setPointer(x, y, true)
    },
    [game, snapshot.phase, toLocal],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (snapshot.phase !== 'playing') return
      const { x, y } = toLocal(e.clientX, e.clientY)
      game.movePointer(x, y)
    },
    [game, snapshot.phase, toLocal],
  )

  const onPointerUp = useCallback(() => {
    game.releasePointer()
  }, [game])

  return {
    snapshot,
    containerRef,
    canvasRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    setMode: (mode: GameMode) => game.setMode(mode),
    play: () => {
      requestTelegramFullscreen()
      lockPortraitOrientation()
      syncTelegramSafeArea()
      void syncRecordsWithCloud().then((records) => {
        const { synced: _synced, ...bundle } = records
        game.applySyncedRecords(bundle)
      })
      game.play()
    },
    pause: () => game.pause(),
    resume: () => game.resume(),
    restart: () => {
      requestTelegramFullscreen()
      lockPortraitOrientation()
      syncTelegramSafeArea()
      game.restart()
    },
    quitToMenu: () => game.quitToMenu(),
    toggleMute: () => game.toggleMute(),
    toggleHaptics: () => game.toggleHaptics(),
  }
}