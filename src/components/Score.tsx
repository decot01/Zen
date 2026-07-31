import { useEffect, useState } from 'react'
import { useSpring, useTransform } from 'framer-motion'

interface ScoreProps {
  value: number
  className?: string
  size?: 'sm' | 'lg' | 'xl'
  /** Spring-tweened digits. Off for in-run HUD (avoids main-thread jank at 120 Hz). */
  animated?: boolean
}

function sizeClass(size: 'sm' | 'lg' | 'xl'): string {
  if (size === 'xl') {
    return 'font-display text-5xl font-medium tracking-[-0.04em] tabular-nums'
  }
  if (size === 'lg') {
    return 'font-display text-3xl font-medium tracking-[-0.03em] tabular-nums'
  }
  return 'font-display text-lg font-semibold tabular-nums leading-none'
}

function StaticScore({
  value,
  className,
  size,
}: Required<Pick<ScoreProps, 'value' | 'size'>> & { className?: string }) {
  return (
    <span className={`inline-block ${sizeClass(size)} ${className ?? ''}`}>
      {Math.round(value).toLocaleString()}
    </span>
  )
}

function AnimatedScore({
  value,
  className,
  size,
}: Required<Pick<ScoreProps, 'value' | 'size'>> & { className?: string }) {
  const spring = useSpring(0, { stiffness: 200, damping: 26, mass: 0.55 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString())
  const [text, setText] = useState(() => Math.round(value).toLocaleString())

  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  useEffect(() => {
    return display.on('change', (v) => setText(v))
  }, [display])

  return (
    <span className={`inline-block ${sizeClass(size)} ${className ?? ''}`}>{text}</span>
  )
}

export function Score({
  value,
  className,
  size = 'sm',
  animated = true,
}: ScoreProps) {
  if (!animated) {
    return <StaticScore value={value} className={className} size={size} />
  }
  return <AnimatedScore value={value} className={className} size={size} />
}
