import { distance } from '@/utils/math'

export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const r = ar + br
  return distance(ax, ay, bx, by) <= r
}

export function findFirstCollision<
  T extends { x: number; y: number; radius: number; hitRadius?: number },
>(
  ax: number,
  ay: number,
  ar: number,
  items: readonly T[],
  predicate?: (item: T) => boolean,
): T | null {
  for (const item of items) {
    if (predicate && !predicate(item)) continue
    const br = item.hitRadius ?? item.radius
    if (circlesOverlap(ax, ay, ar, item.x, item.y, br)) {
      return item
    }
  }
  return null
}
