/**
 * Chrome / system insets for HUD + spawn padding (Capacitor + mobile browser).
 * Uses CSS env(safe-area-inset-*) with device floors under notch / camera.
 */

const EXTRA_TOP_GAP = 22
const EXTRA_BOTTOM_GAP = 10
const NATIVE_TOP_FLOOR = 36
const NATIVE_BOTTOM_FLOOR = 12

function readEnvSafeArea(): { top: number; bottom: number } {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { top: 0, bottom: 0 }
  }
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top,0px);' +
    'padding-bottom:env(safe-area-inset-bottom,0px);'
  document.documentElement.appendChild(probe)
  const style = getComputedStyle(probe)
  const top = Number.parseFloat(style.paddingTop) || 0
  const bottom = Number.parseFloat(style.paddingBottom) || 0
  probe.remove()
  return { top, bottom }
}

export function getChromeInsets(): { top: number; bottom: number } {
  const env = readEnvSafeArea()
  return {
    top: Math.max(env.top, NATIVE_TOP_FLOOR) + EXTRA_TOP_GAP,
    bottom: Math.max(env.bottom, NATIVE_BOTTOM_FLOOR) + EXTRA_BOTTOM_GAP,
  }
}

/** Apply chrome insets to CSS variables used by HUD / menus. */
export function syncChromeSafeArea(): { top: number; bottom: number } {
  const { top, bottom } = getChromeInsets()
  const root = document.documentElement
  root.style.setProperty('--zen-safe-top', `${top}px`)
  root.style.setProperty('--zen-safe-bottom', `${bottom}px`)
  root.style.setProperty(
    '--zen-spawn-top',
    `${Math.max(148, top + 96)}px`,
  )
  return { top, bottom }
}
