import { AnimatePresence, motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { glassSurfaceClassName } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { transitionSpring, transitionSpringSnappy } from '@/lib/motion'
import { Score } from './Score'

interface HUDProps {
  score: number
  best: number
  combo: number
  elapsed: number
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function HudStat({
  label,
  value,
  align,
}: {
  label: string
  value: number
  align: 'left' | 'right'
}) {
  return (
    <div
      className={
        align === 'left' ? 'justify-self-start' : 'justify-self-end'
      }
    >
      <div className="flex flex-col items-center">
        <div
          className="text-[10px] uppercase leading-none tracking-[0.16em] text-muted-foreground"
          style={{ marginRight: '-0.16em' }}
        >
          {label}
        </div>
        <div className="mt-1 flex h-7 items-center leading-none">
          <Score
            value={value}
            className={
              align === 'left' ? 'text-foreground' : 'text-foreground/85'
            }
          />
        </div>
      </div>
    </div>
  )
}

export function HUD({ score, best, combo, elapsed }: HUDProps) {
  const showCombo = combo > 1

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-[var(--zen-safe-top)]">
      <motion.div
        className="mx-auto max-w-md"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionSpringSnappy}
      >
        <Card className={cn(glassSurfaceClassName, 'px-4 py-2.5')}>
          <div className="grid grid-cols-3 items-center gap-3">
            <HudStat label="Score" value={score} align="left" />

            <div className="flex flex-col items-center justify-center justify-self-center">
              <AnimatePresence initial={false}>
                {showCombo && (
                  <motion.div
                    key="combo"
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={transitionSpring}
                  >
                    <div className="mb-1.5 flex justify-center">
                      <Badge className="border-foreground/15 bg-primary px-2.5 py-0.5 text-xs text-primary-foreground">
                        x{combo}
                      </Badge>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.span
                layout
                className="text-[11px] font-medium tabular-nums leading-none tracking-wide text-muted-foreground"
                transition={transitionSpring}
              >
                {formatTime(elapsed)}
              </motion.span>
            </div>

            <HudStat label="Best" value={best} align="right" />
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
