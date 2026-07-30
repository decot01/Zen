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
  /** 1→0 mute on speed stretch after a hard wall kick. */
  private stretchMute = 0
  /** Event-driven damp on speed stretch (1 = normal). */
  stretchScale = 1
  /** When true, physics step skips attraction / walls. */
  motionLocked = false

  private trail: TrailPoint[] = []
  private trailAccum = 0
  private impactCooldown = 0

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
    this.stretchMute = 0
    this.stretchScale = 1
    this.motionLocked = false
    this.impactCooldown = 0
    this.clearTrail()
  }

  clearTrail(): void {
    this.trail = []
    this.trailAccum = 0
  }

  /** Gate wall-hit FX / stretch mute — once per contact. */
  noteWallImpact(): boolean {
    if (this.impactCooldown > 0) return false
    this.impactCooldown = PLAYER.wallImpactCooldown
    this.stretchMute = 1
    return true
  }

  step(
    dt: number,
    target: { x: number; y: number } | null,
    width: number,
    height: number,
  ): void {
    this.time += dt

    if (this.motionLocked) {
      this.vx = 0
      this.vy = 0
      if (this.stretchMute > 0) {
        this.stretchMute = Math.max(
          0,
          this.stretchMute - dt / PLAYER.bounceStretchMuteDuration,
        )
      }
      if (this.impactCooldown > 0) {
        this.impactCooldown = Math.max(0, this.impactCooldown - dt)
      }
      return
    }

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

    if (this.stretchMute > 0) {
      this.stretchMute = Math.max(
        0,
        this.stretchMute - dt / PLAYER.bounceStretchMuteDuration,
      )
    }
    if (this.impactCooldown > 0) {
      this.impactCooldown = Math.max(0, this.impactCooldown - dt)
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
    const base = stretchFromSpeed(this.speed)
    const mute = this.stretchMute * PLAYER.bounceStretchMute
    return base * (1 - mute) * this.stretchScale
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
