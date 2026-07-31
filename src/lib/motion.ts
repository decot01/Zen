import type { Transition, Variants } from 'framer-motion'

/** Stalzone ExtremeInOut — slight overshoot, very smooth. */
export const EASE_EXTREME = [0.34, 1.24, 0.64, 1] as const

export const transitionSmooth: Transition = {
  duration: 0.55,
  ease: EASE_EXTREME,
}

export const transitionFast: Transition = {
  duration: 0.35,
  ease: EASE_EXTREME,
}

/** Soft spring matching Stalzone's weighty, floaty feel. */
export const transitionSpring: Transition = {
  type: 'spring',
  stiffness: 220,
  damping: 26,
  mass: 1.05,
}

export const transitionSpringSnappy: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
  mass: 0.9,
}

/** Segmented control / switch — Stalzone ExtremeInOut, quick glide. */
export const transitionSwitch: Transition = {
  type: 'tween',
  duration: 0.32,
  ease: EASE_EXTREME,
}

/** Label color on the same control. */
export const transitionSwitchLabel: Transition = {
  type: 'tween',
  duration: 0.26,
  ease: EASE_EXTREME,
}

export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: transitionSmooth,
  },
  exit: {
    opacity: 0,
    pointerEvents: 'none',
    transition: transitionFast,
  },
}

export const cardVariants: Variants = {
  initial: { opacity: 0, y: 22, scale: 0.94 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitionSpring,
  },
  exit: {
    opacity: 0,
    y: 12,
    scale: 0.97,
    transition: transitionFast,
  },
}

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitionSpring,
  },
}
