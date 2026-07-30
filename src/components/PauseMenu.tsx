import { motion } from 'framer-motion'
import { Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { IconToggle } from '@/components/IconToggle'
import { cardVariants, staggerContainer, staggerItem } from '@/lib/motion'

interface PauseMenuProps {
  muted: boolean
  haptics: boolean
  onResume: () => void
  onRestart: () => void
  onQuit: () => void
  onToggleMute: () => void
  onToggleHaptics: () => void
}

export function PauseMenu({
  muted,
  haptics,
  onResume,
  onRestart,
  onQuit,
  onToggleMute,
  onToggleHaptics,
}: PauseMenuProps) {
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
          <CardHeader className="items-center pb-2">
            <CardTitle className="text-xl">Paused</CardTitle>
          </CardHeader>
          <Separator className="mx-6 w-auto" />
          <CardContent className="pt-5">
            <motion.div
              className="flex flex-col gap-2.5"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <motion.div variants={staggerItem}>
                <Button size="lg" onClick={onResume} className="w-full">
                  Resume
                </Button>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Button variant="secondary" onClick={onRestart} className="w-full">
                  Restart
                </Button>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Button variant="ghost" onClick={onQuit} className="w-full">
                  Menu
                </Button>
              </motion.div>
            </motion.div>
          </CardContent>
          <CardFooter className="justify-center gap-2">
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
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
