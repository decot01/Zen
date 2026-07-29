import { useEffect, useState } from 'react'
import { useSpring, useTransform } from 'framer-motion'

interface ScoreProps {
  value: number
  className?: string
  size?: 'sm' | 'lg' | 'xl'
}

export function Score({ value, className, size = 'sm' }: ScoreProps) {
  const spring = useSpring(0, { stiffness: 200, damping: 26, mass: 0.55 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString())
  const [text, setText] = useState('0')

  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  useEffect(() => {
    return display.on('change', (v) => setText(v))
  }, [display])

  const sizeClass =
    size === 'xl'
      ? 'font-display text-5xl font-medium tracking-[-0.04em] tabular-nums'
      : size === 'lg'
        ? 'font-display text-3xl font-medium tracking-[-0.03em] tabular-nums'
        : 'font-display text-lg font-semibold tabular-nums leading-none'

  return (
    <span className={`inline-block ${sizeClass} ${className ?? ''}`}>{text}</span>
  )
}
