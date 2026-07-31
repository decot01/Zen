/**
 * Prefer portrait-only play. Browsers often ignore Screen Orientation API
 * outside fullscreen / installed PWA; Telegram has its own lock (Bot API 8+).
 */

function isPortrait(): boolean {
  if (typeof window === 'undefined') return true
  if (window.matchMedia?.('(orientation: portrait)').matches) return true
  return window.innerHeight >= window.innerWidth
}

/** Best-effort lock to portrait (safe to call repeatedly). */
export function lockPortraitOrientation(): void {
  // Telegram: locks *current* orientation — only call while already portrait.
  try {
    const wa = window.Telegram?.WebApp
    if (wa?.initData && isPortrait()) {
      wa.lockOrientation?.()
    }
  } catch {
    // Older clients / missing method.
  }

  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: OrientationLockType) => Promise<void>
  }
  if (typeof orientation?.lock !== 'function') return

  void orientation.lock('portrait').catch(() => {
    void orientation.lock?.('portrait-primary').catch(() => {
      // Mobile Safari / non-fullscreen Chrome typically reject.
    })
  })
}

/** Keep trying when the device returns to portrait. */
export function startPortraitOrientationLock(): () => void {
  lockPortraitOrientation()

  const onChange = () => {
    if (isPortrait()) lockPortraitOrientation()
  }

  window.addEventListener('orientationchange', onChange)
  window.addEventListener('resize', onChange)
  screen.orientation?.addEventListener?.('change', onChange)

  return () => {
    window.removeEventListener('orientationchange', onChange)
    window.removeEventListener('resize', onChange)
    screen.orientation?.removeEventListener?.('change', onChange)
  }
}
