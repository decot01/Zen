import { PLAYER } from './constants'
import { applyAttraction, applyWallBounce, stretchFromSpeed } from './Physics'
import { angleOf, length } from '@/utils/math'

export interface TrailPoint {
  x: number
  y: number
}

export class Player {
  x = 0
  y = 0
  vx = 0
  vy = 0
  radius = PLAYER.radius
  time = 0
  attractStrength: number = PLAYER.attractStrength
  maxSpeed: number = PLAYER.maxSpeed
  /** Gameplay target (0–4). Visual glow eases toward this. */
  comboGlowTarget = 0
  /** Smoothed value used by the renderer. */
  comboGlow = 0

  private trail: TrailPoint[] = []
  private trailAccum = 0

  reset(width: number, height: number): void {
    this.x = width * 0.5
    this.y = height * 0.5
    this.vx = 0
    this.vy = 0
    this.time = 0
    this.attractStrength = PLAYER.attractStrength
    this.maxSpeed = PLAYER.maxSpeed
    this.comboGlowTarget = 0
    this.comboGlow = 0
    this.clearTrail()
  }

  clearTrail(): void {
    this.trail = []
    this.trailAccum = 0
  }

  step(
    dt: number,
    target: { x: number; y: number } | null,
    width: number,
    height: number,
  ): void {
    this.time += dt

    const velocity = { x: this.vx, y: this.vy }
    const position = { x: this.x, y: this.y }

    applyAttraction(
      position,
      velocity,
      target,
      dt,
      this.attractStrength,
      this.maxSpeed,
    )
    applyWallBounce(position, velocity, this.radius, width, height)

    this.x = position.x
    this.y = position.y
    this.vx = velocity.x
    this.vy = velocity.y

    // Rise quickly with combo, fade out softly when the streak drops.
    const rising = this.comboGlowTarget > this.comboGlow
    const rate = rising ? 12 : 1.6
    this.comboGlow +=
      (this.comboGlowTarget - this.comboGlow) * (1 - Math.exp(-rate * dt))
    if (Math.abs(this.comboGlow - this.comboGlowTarget) < 0.01) {
      this.comboGlow = this.comboGlowTarget
    }

    this.updateTrail(dt)
  }

  private updateTrail(dt: number): void {
    this.trailAccum += length(this.vx, this.vy) * dt
    while (this.trailAccum >= PLAYER.trailSpacing) {
      this.trailAccum -= PLAYER.trailSpacing
      this.trail.push({ x: this.x, y: this.y })
      if (this.trail.length > PLAYER.trailLength) {
        this.trail.shift()
      }
    }
  }

  get speed(): number {
    return length(this.vx, this.vy)
  }

  get stretch(): number {
    return stretchFromSpeed(this.speed)
  }

  get heading(): number {
    return angleOf(this.vx, this.vy)
  }

  get pulse(): number {
    return 1 + Math.sin(this.time * PLAYER.pulseSpeed) * PLAYER.pulseAmount
  }

  getTrail(): readonly TrailPoint[] {
    return this.trail
  }

  scaleDifficulty(speedMultiplier: number): void {
    this.attractStrength *= speedMultiplier
    this.maxSpeed *= speedMultiplier
  }
}
