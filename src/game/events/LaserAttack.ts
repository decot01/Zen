import { EVENTS } from '../constants'
import { clamp } from '@/utils/math'

export type LaserPhase = 'tracking' | 'locked' | 'firing' | 'done'

export interface LaserLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface LaserTiming {
  trackDuration?: number
  lockDuration?: number
  /** Aim ahead of player by velocity * seconds while tracking/locking. */
  predictSeconds?: number
}

/**
 * Tracking → lock → fire beam across the arena.
 * Never fires instantly: track + lock must complete first.
 */
export class LaserAttack {
  phase: LaserPhase = 'tracking'
  age = 0
  originX: number
  originY: number
  aimX: number
  aimY: number
  dirX = 1
  dirY = 0
  /** 0→1 during firing flash. */
  fireFlash = 0
  private fired = false
  private hitChecked = false
  hitPlayer = false
  private readonly trackDuration: number
  private readonly lockDuration: number
  private readonly predictSeconds: number

  constructor(
    originX: number,
    originY: number,
    aimX: number,
    aimY: number,
    timing?: LaserTiming,
  ) {
    this.originX = originX
    this.originY = originY
    this.aimX = aimX
    this.aimY = aimY
    this.trackDuration = timing?.trackDuration ?? EVENTS.sniper.trackDuration
    this.lockDuration = timing?.lockDuration ?? EVENTS.sniper.lockDuration
    this.predictSeconds = timing?.predictSeconds ?? 0
    this.retarget(aimX, aimY)
  }

  get trackingProgress(): number {
    return clamp(this.age / this.trackDuration, 0, 1)
  }

  get lockProgress(): number {
    if (this.phase === 'tracking') return 0
    const t = this.age - this.trackDuration
    return clamp(t / this.lockDuration, 0, 1)
  }

  get warningPulse(): number {
    if (this.phase === 'tracking') {
      return 0.45 + 0.55 * Math.sin(this.age * Math.PI * 4)
    }
    if (this.phase === 'locked') {
      return 0.7 + 0.3 * Math.sin(this.age * Math.PI * 10)
    }
    if (this.phase === 'firing') return 1
    return 0
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerVx = 0,
    playerVy = 0,
  ): { justLocked: boolean; justFired: boolean } {
    let justLocked = false
    let justFired = false
    this.age += dt

    const aimX = playerX + playerVx * this.predictSeconds
    const aimY = playerY + playerVy * this.predictSeconds

    if (this.phase === 'tracking') {
      this.retarget(aimX, aimY)
      if (this.age >= this.trackDuration) {
        this.phase = 'locked'
        this.retarget(aimX, aimY)
        justLocked = true
      }
    } else if (this.phase === 'locked') {
      const lockT = this.age - this.trackDuration
      if (lockT >= this.lockDuration) {
        this.phase = 'firing'
        this.fired = true
        this.fireFlash = 1
        justFired = true
      }
    } else if (this.phase === 'firing') {
      this.fireFlash = Math.max(0, this.fireFlash - dt / 0.18)
      if (this.fireFlash <= 0.02) {
        this.phase = 'done'
      }
    }

    return { justLocked, justFired }
  }

  /** One-shot lethal check against the fired beam. */
  checkHit(playerX: number, playerY: number, playerRadius: number): boolean {
    if (!this.fired || this.hitChecked) return this.hitPlayer
    this.hitChecked = true
    const half = EVENTS.sniper.laserHalfWidth
    const dist = this.distanceToBeam(playerX, playerY)
    this.hitPlayer = dist <= half + playerRadius * 0.75
    return this.hitPlayer
  }

  /** Arena-spanning segment for drawing / collision. */
  getArenaLine(width: number, height: number): LaserLine {
    const pad = 4
    const hits = clipRayToRect(
      this.originX,
      this.originY,
      this.dirX,
      this.dirY,
      -pad,
      -pad,
      width + pad * 2,
      height + pad * 2,
    )
    if (!hits) {
      return {
        x1: this.originX,
        y1: this.originY,
        x2: this.originX + this.dirX * 2000,
        y2: this.originY + this.dirY * 2000,
      }
    }
    return { x1: hits[0].x, y1: hits[0].y, x2: hits[1].x, y2: hits[1].y }
  }

  private retarget(x: number, y: number): void {
    this.aimX = x
    this.aimY = y
    const dx = x - this.originX
    const dy = y - this.originY
    const len = Math.hypot(dx, dy) || 1
    this.dirX = dx / len
    this.dirY = dy / len
  }

  private distanceToBeam(px: number, py: number): number {
    // Infinite line through origin along dir.
    return Math.abs(
      (py - this.originY) * this.dirX - (px - this.originX) * this.dirY,
    )
  }
}

/** Two intersection points of a ray with a rectangle (entry + exit). */
function clipRayToRect(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): [{ x: number; y: number }, { x: number; y: number }] | null {
  const ts: number[] = []
  if (Math.abs(dx) > 1e-6) {
    ts.push((rx - ox) / dx)
    ts.push((rx + rw - ox) / dx)
  }
  if (Math.abs(dy) > 1e-6) {
    ts.push((ry - oy) / dy)
    ts.push((ry + rh - oy) / dy)
  }
  const points: { x: number; y: number; t: number }[] = []
  for (const t of ts) {
    const x = ox + dx * t
    const y = oy + dy * t
    if (x >= rx - 0.5 && x <= rx + rw + 0.5 && y >= ry - 0.5 && y <= ry + rh + 0.5) {
      points.push({ x, y, t })
    }
  }
  if (points.length < 2) return null
  points.sort((a, b) => a.t - b.t)
  const a = points[0]!
  const b = points[points.length - 1]!
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: b.y },
  ]
}
