import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { IntelGlow } from '@/components/IntelGlow'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { cardVariants, staggerContainer, staggerItem } from '@/lib/motion'
import { Score } from './Score'

interface GameOverProps {
  score: number
  best: number
  highCombo: number
  isNewBest: boolean
  onPlayAgain: () => void
  onMenu: () => void
}

export function GameOver({
  score,
  best,
  highCombo,
  isNewBest,
  onPlayAgain,
  onMenu,
}: GameOverProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center px-6">
      <motion.div
        className="w-full max-w-xs"
        variants={cardVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Card className="rounded-[2rem] border-border/70 bg-card/95 shadow-2xl backdrop-blur-md">
          <CardHeader className="items-center gap-3 pb-2">
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Score
              </span>
              <Score value={score} size="xl" className="mt-1 text-foreground" />
              {isNewBest && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-2"
                >
                  <IntelGlow radius={999} intensity={0.75}>
                    <Badge
                      variant="outline"
                      className="border-0 bg-card px-3 py-1 text-[11px] uppercase tracking-[0.14em]"
                    >
                      New best
                    </Badge>
                  </IntelGlow>
                </motion.div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="zen-squircle grid grid-cols-2 gap-3 rounded-3xl border border-border bg-background/60 p-3">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Best
                </div>
                <div className="mt-1 font-display text-lg font-semibold tabular-nums tracking-tight">
                  {best.toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Max combo
                </div>
                <div className="mt-1 font-display text-lg font-semibold tabular-nums tracking-tight">
                  x{highCombo}
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-2.5 pt-2">
            <motion.div
              className="flex w-full flex-col gap-2.5"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <motion.div variants={staggerItem}>
                <Button size="lg" onClick={onPlayAgain} className="w-full">
                  Play Again
                </Button>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Button variant="ghost" onClick={onMenu} className="w-full">
                  Menu
                </Button>
              </motion.div>
            </motion.div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
