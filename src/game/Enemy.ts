import { ENEMY, EVENTS } from './constants'
import { clamp, easeOutCubic } from '@/utils/math'
import { randomRange } from '@/utils/random'

export class Enemy {
  x: number
  y: number
  baseX: number
  baseY: number
  radius: number = ENEMY.radius
  age = 0
  alive = true
  berserk = false
  /**
   * Chain Explosion charge: null = idle, 0→1 while charging toward blast.
   */
  chargeT: number | null = null
  /** Phase Shift — harmless while fully/near phased. */
  phased = false
  /** 0→1 visual blend toward phased look. */
  phaseAmount = 0
  /** Shockwave knockback velocity (decays). */
  knockVx = 0
  knockVy = 0
  /** Radar event — 1 while arena is dimmed. */
  radarDim = 0
  /** Radar event — 0→1 highlight after a pulse detects this enemy. */
  radarReveal = 0
  private baseRadius: number = ENEMY.radius
  private phase: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.baseX = x
    this.baseY = y
    this.phase = randomRange(0, Math.PI * 2)
  }

  setBerserk(on: boolean): void {
    this.berserk = on
    this.radius = on
      ? this.baseRadius * EVENTS.berserk.radiusMul
      : this.baseRadius
  }

  setPhased(on: boolean): void {
    this.phased = on
  }

  updatePhaseVisual(dt: number): void {
    const target = this.phased ? 1 : 0
    this.phaseAmount += (target - this.phaseAmount) * (1 - Math.exp(-9 * dt))
    if (Math.abs(this.phaseAmount - target) < 0.01) this.phaseAmount = target
  }

  /** True when contact should kill the player. */
  get isHazardous(): boolean {
    return this.armed && this.phaseAmount < 0.42
  }

  beginCharge(): void {
    this.chargeT = 0
  }

  clearCharge(): void {
    this.chargeT = null
  }

  applyKnock(vx: number, vy: number): void {
    this.knockVx += vx
    this.knockVy += vy
  }

  get charging(): boolean {
    return this.chargeT != null
  }

  get chargeProgress(): number {
    return this.chargeT == null ? 0 : clamp(this.chargeT, 0, 1)
  }

  update(
    dt: number,
    player?: { x: number; y: number } | null,
    bounds?: { minX: number; maxX: number; minY: number; maxY: number },
  ): void {
    this.age += dt

    const damp = Math.exp(-EVENTS.shockwave.knockDecay * dt)
    this.baseX += this.knockVx * dt
    this.baseY += this.knockVy * dt
    this.knockVx *= damp
    this.knockVy *= damp
    if (Math.abs(this.knockVx) < 4) this.knockVx = 0
    if (Math.abs(this.knockVy) < 4) this.knockVy = 0

    if (bounds) {
      this.baseX = clamp(this.baseX, bounds.minX, bounds.maxX)
      this.baseY = clamp(this.baseY, bounds.minY, bounds.maxY)
    }

    if (this.berserk && player) {
      const dx = player.x - this.baseX
      const dy = player.y - this.baseY
      const d = Math.hypot(dx, dy) || 1
      const speed = EVENTS.berserk.huntSpeed
      this.baseX += (dx / d) * speed * dt
      this.baseY += (dy / d) * speed * dt
      if (bounds) {
        this.baseX = clamp(this.baseX, bounds.minX, bounds.maxX)
        this.baseY = clamp(this.baseY, bounds.minY, bounds.maxY)
      }
      this.x = this.baseX + Math.sin(this.age * 1.1 + this.phase) * 3
      this.y = this.baseY + Math.cos(this.age * 0.9 + this.phase) * 2.5
      return
    }
    this.x = this.baseX + Math.sin(this.age * 0.7 + this.phase) * 5
    this.y = this.baseY + Math.cos(this.age * 0.55 + this.phase) * 4
  }

  get armed(): boolean {
    return this.age >= ENEMY.armDuration
  }

  get armProgress(): number {
    return clamp(this.age / ENEMY.armDuration, 0, 1)
  }

  get scale(): number {
    const base = 0.35 + easeOutCubic(this.armProgress) * 0.65
    if (this.chargeT == null) return base
    const p = this.chargeProgress
    const pulse = 0.92 + Math.sin(this.age * (10 + p * 14)) * 0.08
    return base * (1 + p * (EVENTS.chainExplosion.chargeScale - 1)) * pulse
  }

  get alpha(): number {
    const base =
      ENEMY.spawnAlpha + (1 - ENEMY.spawnAlpha) * easeOutCubic(this.armProgress)
    // Phased enemies read as semi-transparent immediately.
    return base * (1 - this.phaseAmount * 0.62)
  }

  get pulse(): number {
    if (!this.armed) return 1
    if (this.chargeT != null) {
      const p = this.chargeProgress
      return 1 + Math.sin(this.age * (12 + p * 18)) * (0.06 + p * 0.12)
    }
    return 1 + Math.sin(this.age * ENEMY.pulseSpeed) * 0.08
  }
}
