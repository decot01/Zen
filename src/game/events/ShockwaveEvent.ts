import { EVENTS } from '../constants'
import { randomRange } from '@/utils/random'
import { BaseEvent } from './BaseEvent'
import type { EventContext, EventId } from './EventContext'

type Edge = 'top' | 'bottom' | 'left' | 'right'

interface ArenaWave {
  edge: Edge
  pos: number
  speed: number
  width: number
  dirX: number
  dirY: number
  hitPlayer: boolean
  alive: boolean
  progress: number
  impactDone: boolean
}

export type ShockwaveVisual = {
  edge: Edge
  pos: number
  width: number
  dirX: number
  dirY: number
  progress: number
  intensity: number
}

/** Sweeping energy line — knocks only the player. */
export class ShockwaveEvent extends BaseEvent {
  readonly id: EventId = 'shockwave'
  readonly duration = EVENTS.shockwave.duration

  private spawnTimer = 0
  private wavesSpawned = 0
  private waves: ArenaWave[] = []

  enter(ctx: EventContext): void {
    super.enter(ctx)
    this.spawnTimer = 0.45
    this.wavesSpawned = 0
    this.waves = []
    ctx.audio.playShockwaveSpawn()
  }

  getWaveVisuals(intensity: number): ShockwaveVisual[] {
    return this.waves
      .filter((w) => w.alive)
      .map((w) => ({
        edge: w.edge,
        pos: w.pos,
        width: w.width,
        dirX: w.dirX,
        dirY: w.dirY,
        progress: w.progress,
        intensity,
      }))
  }

  protected onUpdate(dt: number, ctx: EventContext): void {
    if (ctx.dying || this.fade < 0.04) return

    const cfg = EVENTS.shockwave

    if (!this.exiting && this.wavesSpawned < cfg.maxWaves) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) {
        this.spawnWave(ctx)
        this.wavesSpawned++
        if (this.wavesSpawned < cfg.maxWaves) {
          this.spawnTimer = randomRange(cfg.intervalMin, cfg.intervalMax)
        }
      }
    }

    for (const wave of this.waves) {
      if (!wave.alive) continue
      this.stepWave(wave, dt, ctx)
    }
    this.waves = this.waves.filter((w) => w.alive)
  }

  private spawnWave(ctx: EventContext): void {
    const cfg = EVENTS.shockwave
    const edges: Edge[] = ['top', 'bottom', 'left', 'right']
    const edge = edges[Math.floor(Math.random() * edges.length)]!
    const span =
      edge === 'top' || edge === 'bottom' ? ctx.height : ctx.width
    const speedAbs = span / cfg.travelDuration
    const width = cfg.bandWidth

    let pos = 0
    let speed = 0
    let dirX = 0
    let dirY = 0

    switch (edge) {
      case 'top':
        pos = -width * 0.55
        speed = speedAbs
        dirY = 1
        break
      case 'bottom':
        pos = ctx.height + width * 0.55
        speed = -speedAbs
        dirY = -1
        break
      case 'left':
        pos = -width * 0.55
        speed = speedAbs
        dirX = 1
        break
      case 'right':
        pos = ctx.width + width * 0.55
        speed = -speedAbs
        dirX = -1
        break
    }

    this.waves.push({
      edge,
      pos,
      speed,
      width,
      dirX,
      dirY,
      hitPlayer: false,
      alive: true,
      progress: 0,
      impactDone: false,
    })

    ctx.audio.playShockwaveSpawn()
    ctx.audio.playShockwaveWhoosh()
    ctx.particles.flash = Math.max(ctx.particles.flash, 0.04)
    ctx.particles.shake = Math.max(ctx.particles.shake, 0.03)
    ctx.particles.shakeMag = Math.max(ctx.particles.shakeMag, 1.2)
    this.emitEdgeDust(ctx, edge, 2)
  }

  private stepWave(wave: ArenaWave, dt: number, ctx: EventContext): void {
    wave.pos += wave.speed * dt

    const span =
      wave.edge === 'top' || wave.edge === 'bottom' ? ctx.height : ctx.width
    if (wave.edge === 'top' || wave.edge === 'left') {
      wave.progress = (wave.pos + wave.width * 0.55) / (span + wave.width)
    } else {
      wave.progress =
        (span + wave.width * 0.55 - wave.pos) / (span + wave.width)
    }
    wave.progress = Math.max(0, Math.min(1.15, wave.progress))

    this.applyPlayerHit(wave, ctx)

    // Rare soft trail spark
    if (Math.random() < 0.05) {
      const p = this.sampleOnBand(wave, ctx)
      ctx.particles.emitCollect(p.x, p.y, 1, '#ffffff')
    }

    const pastFar =
      wave.edge === 'top'
        ? wave.pos > ctx.height + wave.width
        : wave.edge === 'bottom'
          ? wave.pos < -wave.width
          : wave.edge === 'left'
            ? wave.pos > ctx.width + wave.width
            : wave.pos < -wave.width

    if (pastFar) {
      if (!wave.impactDone) {
        wave.impactDone = true
        ctx.audio.playShockwaveImpact()
        this.emitEdgeDust(ctx, this.opposite(wave.edge), 2)
        ctx.particles.shake = Math.max(ctx.particles.shake, 0.025)
        ctx.particles.shakeMag = Math.max(ctx.particles.shakeMag, 1)
      }
      wave.alive = false
    }
  }

  private applyPlayerHit(wave: ArenaWave, ctx: EventContext): void {
    if (wave.hitPlayer || ctx.dying) return
    const cfg = EVENTS.shockwave
    const half = wave.width * 0.5
    const dist = this.axisDist(wave, ctx.player.x, ctx.player.y)
    if (dist >= half + ctx.player.radius) return

    wave.hitPlayer = true
    ctx.applyPlayerImpulse(
      wave.dirX * cfg.playerImpulse,
      wave.dirY * cfg.playerImpulse,
      cfg.playerMaxSpeed,
    )
    ctx.audio.playShockwaveImpact()
    ctx.particles.flash = Math.max(ctx.particles.flash, 0.035)
    ctx.particles.emitCollect(ctx.player.x, ctx.player.y, 1, '#ffffff')
  }

  private axisDist(wave: ArenaWave, x: number, y: number): number {
    if (wave.edge === 'top' || wave.edge === 'bottom') {
      return Math.abs(y - wave.pos)
    }
    return Math.abs(x - wave.pos)
  }

  private sampleOnBand(
    wave: ArenaWave,
    ctx: EventContext,
  ): { x: number; y: number } {
    const jitter = (Math.random() - 0.5) * 6
    if (wave.edge === 'top' || wave.edge === 'bottom') {
      return { x: Math.random() * ctx.width, y: wave.pos + jitter }
    }
    return { x: wave.pos + jitter, y: Math.random() * ctx.height }
  }

  private opposite(edge: Edge): Edge {
    if (edge === 'top') return 'bottom'
    if (edge === 'bottom') return 'top'
    if (edge === 'left') return 'right'
    return 'left'
  }

  private emitEdgeDust(ctx: EventContext, edge: Edge, count: number): void {
    for (let i = 0; i < count; i++) {
      let x = 0
      let y = 0
      if (edge === 'top') {
        x = Math.random() * ctx.width
        y = 6 + Math.random() * 16
      } else if (edge === 'bottom') {
        x = Math.random() * ctx.width
        y = ctx.height - 6 - Math.random() * 16
      } else if (edge === 'left') {
        x = 6 + Math.random() * 16
        y = Math.random() * ctx.height
      } else {
        x = ctx.width - 6 - Math.random() * 16
        y = Math.random() * ctx.height
      }
      ctx.particles.emitCollect(x, y, 1, '#ffffff')
    }
  }

  protected exit(_ctx: EventContext): void {
    this.waves = []
  }
}
