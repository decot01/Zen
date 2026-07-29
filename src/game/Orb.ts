import { PRIZE_ORB, WHITE_ORB } from './constants'
import { clamp, easeOutBack, easeOutCubic, length, normalize } from '@/utils/math'
import { randomRange } from '@/utils/random'

export type OrbKind = 'normal' | 'prize'

export class Orb {
  x: number
  y: number
  baseX: number
  baseY: number
  radius = WHITE_ORB.radius
  hitRadius = WHITE_ORB.hitRadius
  time = 0
  spawnProgress = 0
  phase: number
  alive = true
  kind: OrbKind = 'normal'
  /** Seconds left for prize orbs; unused for normal. */
  life = 0
  private fleeVx = 0
  private fleeVy = 0

  constructor(x: number, y: number, kind: OrbKind = 'normal') {
    this.x = x
    this.y = y
    this.baseX = x
    this.baseY = y
    this.phase = randomRange(0, Math.PI * 2)
    this.kind = kind
    if (kind === 'prize') {
      this.radius = PRIZE_ORB.radius
      this.hitRadius = PRIZE_ORB.hitRadius
      this.life = PRIZE_ORB.lifetime
    }
  }

  respawn(x: number, y: number, kind: OrbKind = 'normal'): void {
    this.x = x
    this.y = y
    this.baseX = x
    this.baseY = y
    this.time = 0
    this.spawnProgress = 0
    this.phase = randomRange(0, Math.PI * 2)
    this.alive = true
    this.kind = kind
    this.fleeVx = 0
    this.fleeVy = 0
    if (kind === 'prize') {
      this.radius = PRIZE_ORB.radius
      this.hitRadius = PRIZE_ORB.hitRadius
      this.life = PRIZE_ORB.lifetime
    } else {
      this.radius = WHITE_ORB.radius
      this.hitRadius = WHITE_ORB.hitRadius
      this.life = 0
    }
  }

  update(
    dt: number,
    player?: { x: number; y: number } | null,
    bounds?: { minX: number; maxX: number; minY: number; maxY: number },
  ): void {
    this.time += dt
    this.spawnProgress = clamp(
      this.spawnProgress + dt / WHITE_ORB.spawnScaleDuration,
      0,
      1,
    )

    if (this.kind === 'prize' && this.alive) {
      this.life -= dt
      if (this.life <= 0) {
        this.alive = false
        return
      }
      this.updateFlee(dt, player, bounds)
    }

    const floatAmp =
      this.kind === 'prize'
        ? WHITE_ORB.floatAmplitude * 0.55
        : WHITE_ORB.floatAmplitude
    const floatMix = easeOutCubic(this.spawnProgress)
    this.x =
      this.baseX +
      Math.sin(this.time * WHITE_ORB.floatSpeed + this.phase) *
        floatAmp *
        floatMix
    this.y =
      this.baseY +
      Math.cos(this.time * WHITE_ORB.floatSpeed * 0.85 + this.phase) *
        floatAmp *
        0.7 *
        floatMix
  }

  private updateFlee(
    dt: number,
    player?: { x: number; y: number } | null,
    bounds?: { minX: number; maxX: number; minY: number; maxY: number },
  ): void {
    if (!player || !bounds) return

    const dx = this.baseX - player.x
    const dy = this.baseY - player.y
    const dist = length(dx, dy)

    if (dist < PRIZE_ORB.fleeRange && dist > 1) {
      const dir = normalize(dx, dy)
      // Stronger flee when closer — still reacts early on approach.
      const urgency = 1 - clamp(dist / PRIZE_ORB.fleeRange, 0, 1)
      const urgencySq = urgency * urgency
      const accel = PRIZE_ORB.fleeSpeed * (1.55 + urgency * 1.4 + urgencySq * 2.4)
      this.fleeVx += dir.x * accel * dt
      this.fleeVy += dir.y * accel * dt

      // Sideways weave so straight chases miss more often.
      const weave = Math.sin(this.time * 7.5 + this.phase) * urgency * 120
      this.fleeVx += -dir.y * weave * dt
      this.fleeVy += dir.x * weave * dt
    }

    // Less drag while threatened so it keeps speed.
    const threatened = dist < PRIZE_ORB.fleeRange * 0.75
    const damp = Math.exp(-(threatened ? 0.7 : 1.8) * dt)
    this.fleeVx *= damp
    this.fleeVy *= damp

    const speed = length(this.fleeVx, this.fleeVy)
    const maxSpeed = PRIZE_ORB.fleeSpeed * (threatened ? 1.7 : 1.35)
    if (speed > maxSpeed) {
      this.fleeVx = (this.fleeVx / speed) * maxSpeed
      this.fleeVy = (this.fleeVy / speed) * maxSpeed
    }

    this.baseX += this.fleeVx * dt
    this.baseY += this.fleeVy * dt

    this.baseX = clamp(this.baseX, bounds.minX, bounds.maxX)
    this.baseY = clamp(this.baseY, bounds.minY, bounds.maxY)

    // Soft bounce off playfield edges.
    if (this.baseX <= bounds.minX || this.baseX >= bounds.maxX) this.fleeVx *= -0.65
    if (this.baseY <= bounds.minY || this.baseY >= bounds.maxY) this.fleeVy *= -0.65
  }

  get scale(): number {
    const t = this.spawnProgress
    if (t <= 0) return 0
    return Math.max(0, easeOutBack(t))
  }

  get alpha(): number {
    let a = clamp(this.spawnProgress / 0.35, 0, 1)
    if (this.kind === 'prize' && this.life < 2.2) {
      // Blink when about to despawn.
      a *= 0.35 + 0.65 * Math.abs(Math.sin(this.time * 9))
    }
    return a
  }

  get collectible(): boolean {
    return this.alive && this.spawnProgress >= 0.45
  }

  get appearRing(): { radius: number; alpha: number } | null {
    if (this.spawnProgress >= 1) return null
    const t = this.spawnProgress
    return {
      radius: this.radius * (1.15 + easeOutCubic(t) * 2.4),
      alpha: (1 - t) * 0.4,
    }
  }

  get lifeRatio(): number {
    if (this.kind !== 'prize') return 1
    return clamp(this.life / PRIZE_ORB.lifetime, 0, 1)
  }
}
