import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { transitionSpringSnappy } from '@/lib/motion'

interface IconToggleProps {
  pressed: boolean
  onToggle: () => void
  onIcon: ReactNode
  offIcon: ReactNode
  onLabel: string
  offLabel: string
}

/**
 * Ghost icon control — both icons stay mounted and crossfade/scale,
 * so nothing disappears during the toggle animation.
 */
export function IconToggle({
  pressed,
  onToggle,
  onIcon,
  offIcon,
  onLabel,
  offLabel,
}: IconToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={pressed ? onLabel : offLabel}
      aria-pressed={pressed}
    >
      <motion.span
        className="relative inline-flex h-[18px] w-[18px] items-center justify-center"
        whileTap={{ scale: 0.88 }}
        transition={transitionSpringSnappy}
      >
        <motion.span
          className="absolute inset-0 flex items-center justify-center"
          initial={false}
          animate={{
            opacity: pressed ? 1 : 0,
            scale: pressed ? 1 : 0.72,
            rotate: pressed ? 0 : -12,
          }}
          transition={transitionSpringSnappy}
          aria-hidden={!pressed}
        >
          {onIcon}
        </motion.span>
        <motion.span
          className="absolute inset-0 flex items-center justify-center"
          initial={false}
          animate={{
            opacity: pressed ? 0 : 0.55,
            scale: pressed ? 0.72 : 1,
            rotate: pressed ? 12 : 0,
          }}
          transition={transitionSpringSnappy}
          aria-hidden={pressed}
        >
          {offIcon}
        </motion.span>
      </motion.span>
    </Button>
  )
}
