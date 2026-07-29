import { DIFFICULTY, SPAWN } from './constants'
import { distance } from '@/utils/math'
import { randomRange } from '@/utils/random'

export interface SpawnAvoid {
  x: number
  y: number
  radius: number
  /** Extra clearance — used for enemies when placing white orbs. */
  clearance?: number
  /** Absolute minimum center distance (overrides radius+clearance when set). */
  minDistance?: number
}

/**
 * Finds safe spawn positions away from the player, HUD, and other entities.
 */
export class Spawner {
  safeRadius: number = DIFFICULTY.initialSafeRadius

  reset(): void {
    this.safeRadius = DIFFICULTY.initialSafeRadius
  }

  shrinkSafeSpace(factor: number): void {
    this.safeRadius = Math.max(
      DIFFICULTY.minSafeRadius,
      this.safeRadius * factor,
    )
  }

  findPosition(
    width: number,
    height: number,
    avoid: readonly SpawnAvoid[],
    extraPlayerSafe = 0,
  ): { x: number; y: number } | null {
    const bounds = this.bounds(width, height)

    for (let attempt = 0; attempt < SPAWN.maxAttempts; attempt++) {
      const point = {
        x: randomRange(bounds.minX, bounds.maxX),
        y: randomRange(bounds.minY, bounds.maxY),
      }
      if (this.isClear(point, avoid, extraPlayerSafe, attempt)) {
        return point
      }
    }

    // Soft fallback still respects avoid — never land on orbs/enemies.
    for (let attempt = 0; attempt < SPAWN.maxAttempts; attempt++) {
      const point = {
        x: randomRange(bounds.minX, bounds.maxX),
        y: randomRange(bounds.minY, bounds.maxY),
      }
      if (this.isClear(point, avoid, 0, attempt)) {
        return point
      }
    }

    return null
  }

  /**
   * White orbs prefer sitting near hazards so routes skim past danger,
   * while still clustering with other orbs when possible.
   */
  findOrbPosition(
    width: number,
    height: number,
    avoid: readonly SpawnAvoid[],
    anchors: readonly SpawnAvoid[],
    threats: readonly SpawnAvoid[],
    extraPlayerSafe = 0,
    threatBias: number = SPAWN.orbThreatBiasByStage[0]!,
  ): { x: number; y: number } | null {
    const bounds = this.bounds(width, height)
    const useCluster = anchors.length > 0
    const useThreat = threats.length > 0
    const cappedSafe = Math.min(extraPlayerSafe, SPAWN.maxOrbPlayerSafe)
    const bias = Math.max(0, Math.min(1, threatBias))

    for (let attempt = 0; attempt < SPAWN.maxAttempts; attempt++) {
      const preferThreat = useThreat && Math.random() < bias
      let point: { x: number; y: number } | null = null

      if (preferThreat) {
        point = this.pointNearThreat(threats, bounds, attempt)
      } else if (useCluster) {
        point = this.pointNearAnchors(anchors, bounds, attempt)
      } else {
        point = this.pointNearPlayer(avoid[0], bounds, attempt)
      }

      if (!point) continue

      if (
        this.isClear(point, avoid, cappedSafe, attempt) &&
        (!useCluster || preferThreat || this.withinCluster(point, anchors))
      ) {
        return point
      }
    }

    // Relax: prefer cluster / player ring; rare threat-adjacent retries.
    for (let attempt = 0; attempt < SPAWN.maxAttempts; attempt++) {
      const point =
        useThreat && Math.random() < bias * 0.45
          ? this.pointNearThreat(threats, bounds, attempt, 1.35)
          : useCluster
            ? this.pointNearAnchors(anchors, bounds, attempt, 1.5)
            : this.pointNearPlayer(avoid[0], bounds, attempt, 1.25)
      if (!point) continue
      if (this.isClear(point, avoid, SPAWN.minDistanceFromPlayer * 0.55, attempt)) {
        return point
      }
    }

    // Last resort: in bounds, always keep hazard separation.
    const player = avoid[0]
    for (let attempt = 0; attempt < SPAWN.maxAttempts; attempt++) {
      const point = {
        x: randomRange(bounds.minX, bounds.maxX),
        y: randomRange(bounds.minY, bounds.maxY),
      }
      if (
        player &&
        distance(point.x, point.y, player.x, player.y) <
          SPAWN.minDistanceFromPlayer * 0.5
      ) {
        continue
      }
      if (this.hazardsClear(point, avoid)) return point
    }

    return {
      x: (bounds.minX + bounds.maxX) * 0.5,
      y: (bounds.minY + bounds.maxY) * 0.5,
    }
  }

  private bounds(width: number, height: number) {
    const minX = SPAWN.padding
    const maxX = width - SPAWN.padding
    const minY = SPAWN.padding + SPAWN.topInset
    const maxY = height - SPAWN.padding - SPAWN.bottomInset
    return {
      minX,
      maxX: Math.max(minX + 1, maxX),
      minY,
      maxY: Math.max(minY + 1, maxY),
    }
  }

  private pointNearAnchors(
    anchors: readonly SpawnAvoid[],
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    attempt: number,
    maxScale = 1,
  ): { x: number; y: number } | null {
    const anchor = anchors[attempt % anchors.length]!
    const angle = randomRange(0, Math.PI * 2)
    const radius = randomRange(
      SPAWN.orbClusterMin,
      SPAWN.orbClusterMax * maxScale,
    )
    const x = anchor.x + Math.cos(angle) * radius
    const y = anchor.y + Math.sin(angle) * radius
    if (
      x < bounds.minX ||
      x > bounds.maxX ||
      y < bounds.minY ||
      y > bounds.maxY
    ) {
      return null
    }
    return { x, y }
  }

  /** Reachable ring around the player — avoids long lonely cross-map chases. */
  private pointNearPlayer(
    player: SpawnAvoid | undefined,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    _attempt: number,
    maxScale = 1,
  ): { x: number; y: number } | null {
    if (!player) {
      return {
        x: randomRange(bounds.minX, bounds.maxX),
        y: randomRange(bounds.minY, bounds.maxY),
      }
    }
    const angle = randomRange(0, Math.PI * 2)
    const radius = randomRange(
      SPAWN.orbNearPlayerMin,
      SPAWN.orbNearPlayerMax * maxScale,
    )
    const x = player.x + Math.cos(angle) * radius
    const y = player.y + Math.sin(angle) * radius
    if (
      x < bounds.minX ||
      x > bounds.maxX ||
      y < bounds.minY ||
      y > bounds.maxY
    ) {
      // Nudge into bounds instead of discarding every edge attempt.
      return {
        x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
        y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
      }
    }
    return { x, y }
  }

  /** Place an orb close to a hazard so the player must skim past it. */
  private pointNearThreat(
    threats: readonly SpawnAvoid[],
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    attempt: number,
    maxScale = 1,
  ): { x: number; y: number } | null {
    const threat = threats[attempt % threats.length]!
    const angle = randomRange(0, Math.PI * 2)
    const radius = randomRange(
      SPAWN.orbThreatMin,
      SPAWN.orbThreatMax * maxScale,
    )
    const x = threat.x + Math.cos(angle) * radius
    const y = threat.y + Math.sin(angle) * radius
    if (
      x < bounds.minX ||
      x > bounds.maxX ||
      y < bounds.minY ||
      y > bounds.maxY
    ) {
      return {
        x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
        y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
      }
    }
    return { x, y }
  }

  private withinCluster(
    point: { x: number; y: number },
    anchors: readonly SpawnAvoid[],
  ): boolean {
    let nearest = Infinity
    for (const a of anchors) {
      nearest = Math.min(nearest, distance(point.x, point.y, a.x, a.y))
    }
    return nearest >= SPAWN.orbClusterMin && nearest <= SPAWN.orbClusterMax
  }

  private isClear(
    point: { x: number; y: number },
    avoid: readonly SpawnAvoid[],
    extraPlayerSafe: number,
    attempt: number,
  ): boolean {
    for (let i = 0; i < avoid.length; i++) {
      const a = avoid[i]!
      const gap =
        a.clearance !== undefined
          ? a.clearance
          : SPAWN.minDistanceBetween +
            (extraPlayerSafe > 0 && attempt < SPAWN.maxAttempts * 0.65
              ? extraPlayerSafe * 0.35
              : 0)
      const minDist = a.minDistance ?? a.radius + gap
      if (distance(point.x, point.y, a.x, a.y) < minDist) {
        return false
      }
    }

    if (avoid.length > 0) {
      const player = avoid[0]!
      const need = Math.max(
        SPAWN.minDistanceFromPlayer,
        this.safeRadius * 0.55,
        extraPlayerSafe,
      )
      if (distance(point.x, point.y, player.x, player.y) < need) {
        return false
      }
    }

    return true
  }

  private hazardsClear(
    point: { x: number; y: number },
    avoid: readonly SpawnAvoid[],
  ): boolean {
    for (const a of avoid) {
      if (a.minDistance === undefined && a.clearance === undefined) continue
      const minDist = a.minDistance ?? a.radius + (a.clearance ?? 0)
      if (distance(point.x, point.y, a.x, a.y) < minDist) return false
    }
    return true
  }
}
