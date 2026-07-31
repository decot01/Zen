import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  type PanInfo,
} from 'framer-motion'
import { Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { IconToggle } from '@/components/IconToggle'
import { IntelGlow } from '@/components/IntelGlow'
import { pulseHaptic } from '@/lib/feel'
import {
  staggerContainer,
  staggerItem,
  transitionSwitch,
  transitionSwitchLabel,
} from '@/lib/motion'
import { type GameMode, modeLabel } from '@/game/mode'
import { version } from '../../package.json'

interface MenuProps {
  mode: GameMode
  best: number
  muted: boolean
  haptics: boolean
  onModeChange: (mode: GameMode) => void
  onPlay: () => void
  onToggleMute: () => void
  onToggleHaptics: () => void
}

const MODE_COPY: Record<GameMode, { lead: string; punch: string }> = {
  zen: {
    lead: 'Hold to attract. Release to coast.',
    punch: 'Find the flow.',
  },
  survival: {
    lead: 'Hold to attract. Release to coast.',
    punch: 'Survive the chaos.',
  },
}

const MODES = ['zen', 'survival'] as const
const PAD = 2
const GAP = 6

function ModeSwitcher({
  mode,
  onModeChange,
}: {
  mode: GameMode
  onModeChange: (mode: GameMode) => void
}) {
  const zenRef = useRef<HTMLButtonElement>(null)
  const survivalRef = useRef<HTMLButtonElement>(null)
  const [sizes, setSizes] = useState({ zen: 48, survival: 72 })
  const x = useMotionValue(PAD)
  const w = useMotionValue(48)
  const dragging = useRef(false)
  const skipClick = useRef(false)
  const animX = useRef<ReturnType<typeof animate> | null>(null)
  const animW = useRef<ReturnType<typeof animate> | null>(null)

  const measure = () => {
    const z = zenRef.current?.offsetWidth ?? 48
    const s = survivalRef.current?.offsetWidth ?? 72
    setSizes({ zen: z, survival: s })
  }

  useLayoutEffect(() => {
    measure()
  }, [mode])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const xZen = PAD
  const xSurvival = PAD + sizes.zen + GAP
  const targetX = mode === 'zen' ? xZen : xSurvival
  const targetW = mode === 'zen' ? sizes.zen : sizes.survival

  const glideTo = (nextX: number, nextW: number) => {
    animX.current?.stop()
    animW.current?.stop()
    animX.current = animate(x, nextX, transitionSwitch)
    animW.current = animate(w, nextW, transitionSwitch)
  }

  useEffect(() => {
    if (dragging.current) return
    glideTo(targetX, targetW)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- glide on mode/size settle only
  }, [targetX, targetW])

  const widthFromX = (vx: number) => {
    const span = Math.max(1, xSurvival - xZen)
    const t = Math.min(1, Math.max(0, (vx - xZen) / span))
    return sizes.zen + (sizes.survival - sizes.zen) * t
  }

  const selectMode = (id: GameMode) => {
    if (id === mode) return
    pulseHaptic('ui')
    onModeChange(id)
  }

  const snapFromX = (currentX: number, velocityX: number): GameMode => {
    if (velocityX > 180) return 'survival'
    if (velocityX < -180) return 'zen'
    const dZen = Math.abs(currentX - xZen)
    const dSurv = Math.abs(currentX - xSurvival)
    return dSurv < dZen ? 'survival' : 'zen'
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    dragging.current = false
    if (Math.abs(info.offset.x) > 4) skipClick.current = true
    const next = snapFromX(x.get(), info.velocity.x)
    const nextX = next === 'zen' ? xZen : xSurvival
    const nextW = next === 'zen' ? sizes.zen : sizes.survival
    selectMode(next)
    glideTo(nextX, nextW)
  }

  return (
    <div
      role="tablist"
      aria-label="Game mode"
      className="zen-squircle relative flex w-auto items-center rounded-full border border-border/80 bg-card/80"
      style={{ gap: GAP, padding: PAD }}
    >
      <motion.div
        aria-hidden
        className="zen-squircle absolute z-[1] cursor-grab rounded-full bg-foreground active:cursor-grabbing touch-none will-change-transform"
        style={{
          x,
          width: w,
          left: 0,
          top: PAD,
          bottom: PAD,
        }}
        drag="x"
        dragConstraints={{ left: xZen, right: xSurvival }}
        dragElastic={0.16}
        dragMomentum={false}
        onDragStart={() => {
          dragging.current = true
          animX.current?.stop()
          animW.current?.stop()
        }}
        onDrag={() => {
          w.set(widthFromX(x.get()))
        }}
        onDragEnd={onDragEnd}
      />

      {MODES.map((id) => {
        const active = mode === id
        return (
          <button
            key={id}
            ref={id === 'zen' ? zenRef : survivalRef}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (skipClick.current) {
                skipClick.current = false
                return
              }
              selectMode(id)
            }}
            className={[
              'zen-squircle relative z-[2] inline-flex h-full items-center justify-center rounded-full px-3 py-1',
              active ? 'pointer-events-none' : 'pointer-events-auto',
            ].join(' ')}
          >
            <motion.span
              className="font-display text-[11px] font-medium uppercase leading-none tracking-[0.14em]"
              initial={false}
              animate={{
                color: active ? '#0a0a0a' : '#71717a',
              }}
              transition={transitionSwitchLabel}
            >
              {modeLabel(id)}
            </motion.span>
          </button>
        )
      })}
    </div>
  )
}

export function Menu({
  mode,
  best,
  muted,
  haptics,
  onModeChange,
  onPlay,
  onToggleMute,
  onToggleHaptics,
}: MenuProps) {
  const copy = MODE_COPY[mode]

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent_55%)]" />

      <motion.div
        className="relative flex w-full max-w-sm flex-col items-center text-center"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.h1
          variants={staggerItem}
          className="font-display text-5xl font-medium tracking-[-0.04em] text-foreground sm:text-6xl"
        >
          Zen
        </motion.h1>

        <motion.div
          variants={staggerItem}
          className="mt-3 max-w-[16rem] text-sm leading-relaxed text-muted-foreground"
        >
          <p className="m-0">{copy.lead}</p>
          <div className="relative mt-0 min-h-[1.4em]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={mode}
                className="m-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{
                  type: 'tween',
                  duration: 0.28,
                  ease: [0.34, 1.24, 0.64, 1],
                }}
              >
                {copy.punch}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div
          variants={staggerItem}
          className="mt-9 flex w-full flex-col items-center gap-3"
        >
          <IntelGlow radius={999} intensity={mode === 'survival' ? 0.75 : 0}>
            <ModeSwitcher mode={mode} onModeChange={onModeChange} />
          </IntelGlow>

          <Button size="lg" onClick={onPlay} className="w-full max-w-[220px]">
            Play
          </Button>

          {best > 0 && (
            <IntelGlow radius={999} intensity={0.75} className="mt-[5px]">
              <Badge
                variant="outline"
                className="inline-flex items-center justify-center gap-1.5 border-0 bg-card px-3 py-1 text-[11px] uppercase tracking-[0.14em]"
              >
                <span>Best</span>
                <span className="font-display tabular-nums tracking-tight text-foreground">
                  {best.toLocaleString()}
                </span>
              </Badge>
            </IntelGlow>
          )}

          <div className="flex items-center justify-center gap-2">
            <IconToggle
              pressed={!muted}
              onToggle={onToggleMute}
              onIcon={<Volume2 size={18} strokeWidth={1.75} />}
              offIcon={<VolumeX size={18} strokeWidth={1.75} />}
              onLabel="Mute"
              offLabel="Unmute"
            />
            <IconToggle
              pressed={haptics}
              onToggle={onToggleHaptics}
              onIcon={<Vibrate size={18} strokeWidth={1.75} />}
              offIcon={<VibrateOff size={18} strokeWidth={1.75} />}
              onLabel="Disable haptics"
              offLabel="Enable haptics"
            />
          </div>
        </motion.div>
      </motion.div>

      <p className="pointer-events-none absolute inset-x-0 bottom-0 pb-[max(1rem,var(--zen-safe-bottom))] text-center text-[10px] tabular-nums tracking-[0.14em] text-muted-foreground/50">
        {version}
      </p>
    </div>
  )
}
