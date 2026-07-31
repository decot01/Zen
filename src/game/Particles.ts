import { COMBO_FX, PARTICLES, PLAYER } from './constants'
import { randomRange } from '@/utils/random'

/** Keep death shards outside the player disc so they don't look like the ball. */
const PLAYER_DEATH_OFFSET = PLAYER.radius * 1.15

export type ParticleKind = 'collect' | 'death' | 'combo'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  kind: ParticleKind
  alive: boolean
}

export interface Shockwave {
  x: number
  y: number
  age: number
  duration: number
  maxRadius: number
  alive: boolean
  kind: 'death' | 'combo'
}

export interface ScorePopup {
  x: number
  y: number
  value: number
  combo: number
  age: number
  life: number
  alive: boolean
  label?: string
}

/**
 * Particle system with a simple pool to avoid GC spikes on mobile.
 */
export class ParticleSystem {
  private pool: Particle[] = []
  private active: Particle[] = []
  shockwaves: Shockwave[] = []
  popups: ScorePopup[] = []
  flash = 0
  shake = 0
  shakeMag = 0

  private acquire(): Particle {
    const p = this.pool.pop()
    if (p) return p
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#fff',
      kind: 'collect',
      alive: false,
    }
  }

  private release(p: Particle): void {
    p.alive = false
    if (this.pool.length < PARTICLES.maxCount) {
      this.pool.push(p)
    }
  }

  clear(): void {
    for (const p of this.active) this.release(p)
    this.active = []
    this.shockwaves = []
    this.popups = []
    this.flash = 0
    this.shake = 0
    this.shakeMag = 0
  }

  emitCollect(x: number, y: number, combo: number, color: string): void {
    const count = Math.min(
      PARTICLES.collectCount + (combo - 1) * 2,
      22,
    )
    const sizeBoost = 1 + (combo - 1) * 0.14
    this.burst(x, y, count, PARTICLES.collectSpeed, PARTICLES.collectLife, color, 'collect', sizeBoost)
  }

  /** Soft expanding rings when streak climbs — no screen/player flash. */
  emitCombo(x: number, y: number, level: number): void {
    const scale = 1 + (level - 2) * 0.18
    this.shockwaves.push({
      x,
      y,
      age: 0,
      duration: COMBO_FX.ringDuration,
      maxRadius: COMBO_FX.ringMaxRadius * scale,
      alive: true,
      kind: 'combo',
    })
    this.shockwaves.push({
      x,
      y,
      age: -0.06,
      duration: COMBO_FX.ringDuration * 1.1,
      maxRadius: COMBO_FX.ringMaxRadius * 0.55 * scale,
      alive: true,
      kind: 'combo',
    })

    this.popups.push({
      x,
      y: y - 28,
      value: 0,
      combo: level,
      age: 0,
      life: 0.7,
      alive: true,
      label: `x${level}`,
    })
  }

  emitDeath(x: number, y: number): void {
    // Spawn shards already offset from center so they never read as the player ball.
    this.burst(
      x,
      y,
      PARTICLES.deathCount,
      PARTICLES.deathSpeed,
      PARTICLES.deathLife,
      '#FFFFFF',
      'death',
      1.15,
      PLAYER_DEATH_OFFSET,
    )
    this.burst(
      x,
      y,
      16,
      PARTICLES.deathSpeed * 0.75,
      PARTICLES.deathLife * 0.8,
      '#71717A',
      'death',
      0.95,
      PLAYER_DEATH_OFFSET * 0.85,
    )
    this.shockwaves.push({
      x,
      y,
      age: 0,
      duration: PARTICLES.shockwaveDuration,
      maxRadius: PARTICLES.shockwaveMaxRadius,
      alive: true,
      kind: 'death',
    })
    this.shake = 1
    this.shakeMag = PARTICLES.shakeMagnitude
  }

  addPopup(
    x: number,
    y: number,
    value: number,
    combo: number,
    life: number,
    label?: string,
  ): void {
    this.popups.push({ x, y, value, combo, age: 0, life, alive: true, label })
  }

  emitBerserkTrail(x: number, y: number): void {
    const p = this.acquire()
    p.x = x + randomRange(-4, 4)
    p.y = y + randomRange(-4, 4)
    p.vx = randomRange(-20, 20)
    p.vy = randomRange(-30, -8)
    p.life = 0.35
    p.maxLife = 0.35
    p.size = randomRange(2.5, 5)
    p.color = 'rgba(180, 60, 60, 0.9)'
    p.kind = 'death'
    p.alive = true
    this.active.push(p)
    if (this.active.length > PARTICLES.maxCount) {
      const old = this.active[0]!
      const last = this.active.pop()!
      if (this.active.length > 0) this.active[0] = last
      this.release(old)
    }
  }

  private burst(
    x: number,
    y: number,
    count: number,
    speed: number,
    life: number,
    color: string,
    kind: ParticleKind,
    sizeBoost: number,
    spawnOffset = 0,
  ): void {
    const room = PARTICLES.maxCount - this.active.length
    const n = Math.min(count, Math.max(0, room))
    for (let i = 0; i < n; i++) {
      const angle = randomRange(0, Math.PI * 2)
      const spd = randomRange(speed * 0.35, speed)
      const ox = Math.cos(angle)
      const oy = Math.sin(angle)
      const p = this.acquire()
      p.x = x + ox * spawnOffset
      p.y = y + oy * spawnOffset
      p.vx = ox * spd
      p.vy = oy * spd
      p.maxLife = randomRange(life * 0.6, life)
      p.life = p.maxLife
      p.size = randomRange(1.5, 4.2) * sizeBoost
      p.color = color
      p.kind = kind
      p.alive = true
      this.active.push(p)
    }
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]!
      p.life -= dt
      if (p.life <= 0) {
        const last = this.active.pop()!
        if (i < this.active.length) this.active[i] = last
        this.release(p)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      const damp = p.kind === 'combo' ? 3.2 : 2.2
      p.vx *= Math.exp(-damp * dt)
      p.vy *= Math.exp(-damp * dt)
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i]!
      s.age += dt
      if (s.age >= s.duration) {
        s.alive = false
        const last = this.shockwaves.pop()!
        if (i < this.shockwaves.length) this.shockwaves[i] = last
      }
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i]!
      pop.age += dt
      if (pop.age >= pop.life) {
        pop.alive = false
        const last = this.popups.pop()!
        if (i < this.popups.length) this.popups[i] = last
      }
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt / PARTICLES.flashDuration)
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt / PARTICLES.shakeDuration)
    }
  }

  getParticles(): readonly Particle[] {
    return this.active
  }

  getShakeOffset(): { x: number; y: number } {
    if (this.shake <= 0) return { x: 0, y: 0 }
    const mag = this.shakeMag * this.shake
    return {
      x: (Math.random() - 0.5) * 2 * mag,
      y: (Math.random() - 0.5) * 2 * mag,
    }
  }
}
