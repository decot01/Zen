import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'

/** Palette from apple-intelligence-glow-react */
const COLORS = ['#BC82F3', '#F5B9EA', '#8D9FFF', '#FF6778', '#FFBA71', '#C686FF']

function generateConicGradientString(): string {
  const stops = COLORS.map((color) => ({
    color,
    location: Math.random() * 100,
  })).sort((a, b) => a.location - b.location)

  return `conic-gradient(from 0deg, ${stops
    .map((s) => `${s.color} ${s.location.toFixed(2)}%`)
    .join(', ')})`
}

type RingConfig = {
  width: number
  blur: number
  interval: number
  duration: number
}

class GlowRing {
  private width: number
  private blur: number
  private interval: number
  private duration: number
  private timerId: number | null = null
  private el: HTMLDivElement
  private buffer1: HTMLDivElement
  private buffer2: HTMLDivElement
  private activeBuffer = 1

  constructor(container: HTMLElement, config: RingConfig) {
    this.width = config.width
    this.blur = config.blur
    this.interval = config.interval * 1000
    this.duration = config.duration

    this.el = document.createElement('div')
    this.el.className = 'zen-aie-effect-layer'
    if (this.blur > 0) this.el.style.filter = `blur(${this.blur}px)`

    const ring = document.createElement('div')
    ring.className = 'zen-aie-ring-container'

    this.buffer1 = this.createBuffer()
    this.buffer2 = this.createBuffer()
    this.setGradient(this.buffer1, generateConicGradientString())
    this.buffer1.style.opacity = '1'
    this.buffer2.style.opacity = '0'

    ring.appendChild(this.buffer1)
    ring.appendChild(this.buffer2)
    this.el.appendChild(ring)
    container.appendChild(this.el)
    this.startTimer()
  }

  private createBuffer(): HTMLDivElement {
    const div = document.createElement('div')
    div.className = 'zen-aie-gradient-buffer'
    div.style.padding = `${this.width}px`
    div.style.transitionDuration = `${this.duration}s`
    div.style.transitionTimingFunction = 'ease-in-out'
    return div
  }

  private setGradient(element: HTMLDivElement, gradientString: string) {
    element.style.backgroundImage = gradientString
  }

  private startTimer() {
    this.timerId = window.setInterval(() => this.animate(), this.interval)
  }

  private animate() {
    const next = generateConicGradientString()
    if (this.activeBuffer === 1) {
      this.setGradient(this.buffer2, next)
      this.buffer2.style.opacity = '1'
      this.buffer1.style.opacity = '0'
      this.activeBuffer = 2
    } else {
      this.setGradient(this.buffer1, next)
      this.buffer1.style.opacity = '1'
      this.buffer2.style.opacity = '0'
      this.activeBuffer = 1
    }
  }

  destroy() {
    if (this.timerId) {
      window.clearInterval(this.timerId)
      this.timerId = null
    }
    this.el.remove()
  }
}

const STYLE_ID = 'zen-apple-intelligence-glow'

const CSS = `
.zen-aie-root {
  position: relative;
  display: inline-block;
  border-radius: var(--zen-aie-radius, 999px);
  overflow: visible;
}
.zen-aie-rings {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  border-radius: inherit;
  overflow: visible;
}
.zen-aie-content {
  position: relative;
  z-index: 1;
}
.zen-aie-effect-layer {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}
.zen-aie-ring-container {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--zen-aie-radius, 999px);
}
.zen-aie-gradient-buffer {
  position: absolute;
  inset: 0;
  border-radius: var(--zen-aie-radius, 999px);
  background-repeat: no-repeat;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  transition-property: opacity;
  will-change: opacity;
}
`

function injectStylesOnce() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

interface IntelGlowProps {
  radius?: number | string
  className?: string
  style?: CSSProperties
  children?: ReactNode
  /** Multiply overall glow strength (0–1). */
  intensity?: number
}

/**
 * Apple Intelligence–style animated glow border
 * (same technique as apple-intelligence-glow-react, slower + subtler for Zen).
 */
export function IntelGlow({
  radius = 999,
  className = '',
  style,
  children,
  intensity = 0.7,
}: IntelGlowProps) {
  const ringsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    injectStylesOnce()
  }, [])

  useEffect(() => {
    const container = ringsRef.current
    if (!container) return

    // Soft rings only — no sharp unblurred edge (avoids a harsh hairline on pills).
    const rings = [
      new GlowRing(container, { width: 5, blur: 4, interval: 3.2, duration: 2.4 }),
      new GlowRing(container, { width: 8, blur: 10, interval: 3.6, duration: 2.8 }),
      new GlowRing(container, { width: 11, blur: 16, interval: 4.0, duration: 3.2 }),
      new GlowRing(container, { width: 14, blur: 22, interval: 4.5, duration: 3.6 }),
    ]

    return () => {
      rings.forEach((r) => r.destroy())
      container.replaceChildren()
    }
  }, [])

  return (
    <div
      className={`zen-aie-root ${className}`}
      style={{
        ['--zen-aie-radius' as string]:
          typeof radius === 'number' ? `${radius}px` : radius,
        ...style,
      }}
    >
      <div
        ref={ringsRef}
        className="zen-aie-rings"
        style={{
          opacity: intensity,
          transition: 'opacity 0.32s cubic-bezier(0.34, 1.24, 0.64, 1)',
        }}
      />
      <div className="zen-aie-content">{children}</div>
    </div>
  )
}
