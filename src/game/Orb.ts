import { PRIZE_ORB, WHITE_ORB } from './constants'
import { clamp, easeOutBack, easeOutCubic, length, normalize } from '@/utils/math'
import { randomRange } from '@/utils/random'

export type OrbKind = 'normal' | 'prize'

export class Orb {
  x: number
  y: number
  baseX: number
  baseY: number
  radius: number = WHITE_ORB.radius
  hitRadius: number = WHITE_ORB.hitRadius
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
    hazards: readonly { x: number; y: number; radius: number }[] = [],
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
      this.updateFlee(dt, player, bounds, hazards)
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
    hazards: readonly { x: number; y: number; radius: number }[] = [],
  ): void {
    if (!player || !bounds) return

    const dx = this.baseX - player.x
    const dy = this.baseY - player.y
    const dist = length(dx, dy)

    let fleeX = 0
    let fleeY = 0
    if (dist < PRIZE_ORB.fleeRange && dist > 1) {
      const dir = normalize(dx, dy)
      const urgency = 1 - clamp(dist / PRIZE_ORB.fleeRange, 0, 1)
      const urgencySq = urgency * urgency
      const accel = PRIZE_ORB.fleeSpeed * (1.2 + urgency * 1.2 + urgencySq * 1.95)
      fleeX = dir.x * accel
      fleeY = dir.y * accel

      const weave = Math.sin(this.time * 7 + this.phase) * urgency * 100
      fleeX += -dir.y * weave
      fleeY += dir.x * weave
    }

    let avoidX = 0
    let avoidY = 0
    let nearestGap = Number.POSITIVE_INFINITY
    for (const hazard of hazards) {
      const softClear = this.radius + hazard.radius + PRIZE_ORB.hazardPadding
      const hx = this.baseX - hazard.x
      const hy = this.baseY - hazard.y
      const hDist = length(hx, hy)
      if (hDist >= softClear || hDist < 0.001) continue
      nearestGap = Math.min(nearestGap, hDist - (this.radius + hazard.radius))

      const away = normalize(hx, hy)
      let sideX = -away.y
      let sideY = away.x
      if (fleeX !== 0 || fleeY !== 0) {
        if (sideX * fleeX + sideY * fleeY < 0) {
          sideX = -sideX
          sideY = -sideY
        }
      } else {
        const toPlayerX = player.x - this.baseX
        const toPlayerY = player.y - this.baseY
        if (sideX * toPlayerX + sideY * toPlayerY > 0) {
          sideX = -sideX
          sideY = -sideY
        }
      }

      const closeness = 1 - clamp(hDist / softClear, 0, 1)
      const weight = closeness * closeness * (1 + closeness)
      const hardClear = this.radius + hazard.radius + 14
      const outward = hDist < hardClear ? 1.6 : 0.4
      const lateral = hDist < hardClear ? 0.7 : 1.25
      avoidX += (away.x * outward + sideX * lateral) * weight
      avoidY += (away.y * outward + sideY * lateral) * weight
    }

    const avoiding = avoidX !== 0 || avoidY !== 0
    const fleeScale = avoiding ? (nearestGap < 22 ? 0.28 : 0.5) : 1

    if (avoiding) {
      const avoidDir = normalize(avoidX, avoidY)
      const avoidAccel =
        PRIZE_ORB.fleeSpeed * (nearestGap < 22 ? 4.2 : 3.1)
      this.fleeVx += (fleeX * fleeScale + avoidDir.x * avoidAccel) * dt
      this.fleeVy += (fleeY * fleeScale + avoidDir.y * avoidAccel) * dt
    } else {
      this.fleeVx += fleeX * dt
      this.fleeVy += fleeY * dt
    }

    const threatened = dist < PRIZE_ORB.fleeRange * 0.72
    const damp = Math.exp(-(avoiding ? 0.45 : threatened ? 0.72 : 1.85) * dt)
    this.fleeVx *= damp
    this.fleeVy *= damp

    const speed = length(this.fleeVx, this.fleeVy)
    const maxSpeed =
      PRIZE_ORB.fleeSpeed *
      (avoiding ? 1.55 : threatened ? 1.52 : 1.22)
    if (speed > maxSpeed) {
      this.fleeVx = (this.fleeVx / speed) * maxSpeed
      this.fleeVy = (this.fleeVy / speed) * maxSpeed
    }

    // Substep + hard collision so high flee speed can't tunnel through enemies.
    const stepSpeed = length(this.fleeVx, this.fleeVy)
    const steps = Math.max(1, Math.min(6, Math.ceil((stepSpeed * dt) / 6)))
    const stepDt = dt / steps
    for (let i = 0; i < steps; i++) {
      this.baseX += this.fleeVx * stepDt
      this.baseY += this.fleeVy * stepDt
      this.resolveHazardCollisions(hazards)
    }

    const wallPad = 36
    if (this.baseX < bounds.minX + wallPad) this.fleeVx += PRIZE_ORB.fleeSpeed * 1.8 * dt
    if (this.baseX > bounds.maxX - wallPad) this.fleeVx -= PRIZE_ORB.fleeSpeed * 1.8 * dt
    if (this.baseY < bounds.minY + wallPad) this.fleeVy += PRIZE_ORB.fleeSpeed * 1.8 * dt
    if (this.baseY > bounds.maxY - wallPad) this.fleeVy -= PRIZE_ORB.fleeSpeed * 1.8 * dt

    this.baseX = clamp(this.baseX, bounds.minX, bounds.maxX)
    this.baseY = clamp(this.baseY, bounds.minY, bounds.maxY)

    if (this.baseX <= bounds.minX || this.baseX >= bounds.maxX) this.fleeVx *= -0.55
    if (this.baseY <= bounds.minY || this.baseY >= bounds.maxY) this.fleeVy *= -0.55

    this.resolveHazardCollisions(hazards)
  }

  /** Hard circle push — soft steering alone tunnels at flee speed. */
  private resolveHazardCollisions(
    hazards: readonly { x: number; y: number; radius: number }[],
  ): void {
    for (let pass = 0; pass < 3; pass++) {
      let hit = false
      for (const hazard of hazards) {
        const minDist = this.radius + hazard.radius + 3
        let hx = this.baseX - hazard.x
        let hy = this.baseY - hazard.y
        let hDist = length(hx, hy)

        if (hDist < 0.001) {
          const fallback = normalize(this.fleeVx || 1, this.fleeVy)
          hx = fallback.x
          hy = fallback.y
          hDist = 1
        }

        if (hDist >= minDist) continue
        hit = true

        const nx = hx / hDist
        const ny = hy / hDist
        this.baseX = hazard.x + nx * minDist
        this.baseY = hazard.y + ny * minDist

        // Kill inward velocity so it slides around instead of re-entering.
        const into = this.fleeVx * nx + this.fleeVy * ny
        if (into < 0) {
          this.fleeVx -= into * nx
          this.fleeVy -= into * ny
        }

        let tx = -ny
        let ty = nx
        if (tx * this.fleeVx + ty * this.fleeVy < 0) {
          tx = -tx
          ty = -ty
        }
        this.fleeVx += tx * 55
        this.fleeVy += ty * 55
      }
      if (!hit) break
    }
  }

  get scale(): number {
    const t = this.spawnProgress
    if (t <= 0) return 0
    return Math.max(0, easeOutBack(t))
  }

  get alpha(): number {
    let a = clamp(this.spawnProgress / 0.35, 0, 1)
    if (this.kind === 'prize' && this.life < 2.2) {
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
