export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1))
}

export function randomSign(): number {
  return Math.random() < 0.5 ? -1 : 1
}

export function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

/** Random point in a rectangle with optional inset padding. */
export function randomPointInRect(
  width: number,
  height: number,
  padding = 0,
): { x: number; y: number } {
  return {
    x: randomRange(padding, Math.max(padding, width - padding)),
    y: randomRange(padding, Math.max(padding, height - padding)),
  }
}
