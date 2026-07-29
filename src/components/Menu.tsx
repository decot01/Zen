import { motion } from 'framer-motion'
import { Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { IconToggle } from '@/components/IconToggle'
import { IntelGlow } from '@/components/IntelGlow'
import { staggerContainer, staggerItem } from '@/lib/motion'

interface MenuProps {
  best: number
  muted: boolean
  haptics: boolean
  onPlay: () => void
  onToggleMute: () => void
  onToggleHaptics: () => void
}

export function Menu({
  best,
  muted,
  haptics,
  onPlay,
  onToggleMute,
  onToggleHaptics,
}: MenuProps) {
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

        <motion.p
          variants={staggerItem}
          className="mt-3 max-w-[16rem] text-sm leading-relaxed text-muted-foreground"
        >
          Hold to attract. Release to coast. Survive the chaos.
        </motion.p>

        <motion.div
          variants={staggerItem}
          className="mt-9 flex w-full flex-col items-center gap-3"
        >
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
    </div>
  )
}
