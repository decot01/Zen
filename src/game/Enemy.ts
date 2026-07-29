import { ENEMY } from './constants'
import { clamp, easeOutCubic } from '@/utils/math'
import { randomRange } from '@/utils/random'

export class Enemy {
  x: number
  y: number
  baseX: number
  baseY: number
  radius = ENEMY.radius
  age = 0
  alive = true
  private phase: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.baseX = x
    this.baseY = y
    this.phase = randomRange(0, Math.PI * 2)
  }

  update(dt: number): void {
    this.age += dt
    // Subtle drift so hazards feel alive without being unpredictable
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
    return 0.35 + easeOutCubic(this.armProgress) * 0.65
  }

  get alpha(): number {
    return ENEMY.spawnAlpha + (1 - ENEMY.spawnAlpha) * easeOutCubic(this.armProgress)
  }

  get pulse(): number {
    if (!this.armed) return 1
    return 1 + Math.sin(this.age * ENEMY.pulseSpeed) * 0.08
  }
}
