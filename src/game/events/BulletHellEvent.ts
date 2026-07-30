import { EVENTS } from '../constants'
import { BaseEvent } from './BaseEvent'
import type { EventContext, EventId } from './EventContext'
import type { SniperVisual } from './SniperEvent'
import { SniperDrone, type DroneEdge } from './SniperDrone'

export type BulletHellVisual = SniperVisual

/**
 * Boss phase: Crossfire storm + hunting yellow execution lasers.
 * Reuses SniperDrone / LaserAttack — no projectile system.
 */
export class BulletHellEvent extends BaseEvent {
  readonly id: EventId = 'bulletHell'
  readonly duration = EVENTS.bulletHell.duration

  private waves = 0
  private waveTimer = 0.35
  private yellowTimer = 2.2
  private yellowFired = 0
  private drones: SniperDrone[] = []

  enter(ctx: EventContext): void {
    super.enter(ctx)
    this.waves = 0
    this.waveTimer = 0.35
    this.yellowTimer = EVENTS.bulletHell.yellowCooldown * 0.7
    this.yellowFired = 0
    this.drones = []
    ctx.audio.playSniperStart()
  }

  getVisuals(intensity: number, width: number, height: number): BulletHellVisual {
    const drones: SniperVisual['drones'] = []
    const lasers: SniperVisual['lasers'] = []
    for (const drone of this.drones) {
      if (drone.done) continue
      drones.push({
        x: drone.x,
        y: drone.y,
        appear: drone.appear,
        edge: drone.edge,
        tint: drone.tint,
      })
      const laser = drone.laser
      if (laser.phase !== 'done') {
        lasers.push({
          line: laser.getArenaLine(width, height),
          phase: laser.phase,
          warningPulse: laser.warningPulse,
          trackingProgress: laser.trackingProgress,
          lockProgress: laser.lockProgress,
          fireFlash: laser.fireFlash,
          tint: drone.tint,
        })
      }
    }
    return { intensity: Math.min(1, intensity * 1.15), drones, lasers }
  }

  protected onUpdate(dt: number, ctx: EventContext): void {
    if (ctx.dying) {
      this.drones = []
      return
    }

    let anyFired = false
    let anyLocked = false
    let yellowLocked = false
    let yellowFired = false
    let hit = false

    for (const drone of this.drones) {
      if (drone.done) continue
      const { justLocked, justFired } = drone.update(
        dt,
        ctx.player.x,
        ctx.player.y,
        ctx.player.vx,
        ctx.player.vy,
      )
      if (justLocked) {
        anyLocked = true
        if (drone.tint === 'yellow') yellowLocked = true
      }
      if (justFired) {
        anyFired = true
        if (drone.tint === 'yellow') yellowFired = true
        if (
          drone.laser.checkHit(ctx.player.x, ctx.player.y, ctx.player.radius)
        ) {
          hit = true
        }
        this.impactFx(ctx, drone)
      }
    }

    if (yellowLocked) ctx.audio.playYellowLaserWarn()
    else if (anyLocked) ctx.audio.playSniperLock()
    if (yellowFired) ctx.audio.playYellowLaserFire()
    else if (anyFired) ctx.audio.playSniperFire()

    this.drones = this.drones.filter((d) => !d.done)

    if (hit) {
      ctx.killPlayer()
      return
    }

    if (this.exiting) return

    const cfg = EVENTS.bulletHell

    // Yellow hunter — independent of crossfire wave cadence.
    if (this.yellowFired < cfg.maxYellow) {
      this.yellowTimer -= dt
      if (this.yellowTimer <= 0) {
        this.spawnYellowLaser(ctx)
        this.yellowFired += 1
        this.yellowTimer = cfg.yellowCooldown
      }
    }

    if (this.waves >= cfg.maxWaves) {
      if (
        this.drones.length === 0 &&
        this.yellowFired >= cfg.maxYellow
      ) {
        this.beginExit(ctx)
      }
      return
    }

    const redActive = this.drones.some((d) => d.tint === 'red' && !d.done)
    if (redActive) return

    this.waveTimer -= dt
    if (this.waveTimer > 0) return

    this.executeLaserAttack(ctx)
    this.waves += 1
    const t = this.waves / Math.max(1, cfg.maxWaves)
    this.waveTimer =
      cfg.intervalEarly + (cfg.intervalLate - cfg.intervalEarly) * t
  }

  executeLaserAttack(ctx: EventContext): void {
    const edges = this.selectLaserDirection(this.waves)
    for (const edge of edges) {
      this.activateLaserLine(edge, ctx)
    }
    ctx.audio.playSniperSpawn()
  }

  spawnYellowLaser(ctx: EventContext): void {
    const edges: DroneEdge[] = ['top', 'bottom', 'left', 'right']
    // Prefer a direction that threatens a likely safe pocket.
    const safe = this.selectSafeZone(ctx)
    let edge: DroneEdge = edges[Math.floor(Math.random() * edges.length)]!
    if (safe) {
      const dx = Math.abs(safe.x - ctx.player.x)
      const dy = Math.abs(safe.y - ctx.player.y)
      if (dx >= dy) {
        edge = safe.x >= ctx.player.x ? 'right' : 'left'
      } else {
        edge = safe.y >= ctx.player.y ? 'bottom' : 'top'
      }
    }

    const cfg = EVENTS.bulletHell
    this.drones.push(
      SniperDrone.spawnOnEdge(
        edge,
        ctx.width,
        ctx.height,
        ctx.player.x,
        ctx.player.y,
        {
          trackDuration: cfg.yellowTrack,
          lockDuration: cfg.yellowLock,
          predictSeconds: cfg.yellowPredict,
        },
        'yellow',
      ),
    )
    ctx.audio.playSniperSpawn()
  }

  /** Approximate a gap between active red beams for yellow to threaten. */
  selectSafeZone(ctx: EventContext): { x: number; y: number } | null {
    const reds = this.drones.filter(
      (d) => d.tint === 'red' && !d.done && d.laser.phase !== 'done',
    )
    if (reds.length === 0) {
      return { x: ctx.width * 0.5, y: ctx.height * 0.5 }
    }

    // Sample a few arena points; pick farthest from all red aim lines.
    let best = { x: ctx.player.x, y: ctx.player.y, score: -1 }
    const samples = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
      [0.5, 0.35],
      [0.5, 0.65],
      [0.35, 0.5],
      [0.65, 0.5],
    ] as const
    for (const [fx, fy] of samples) {
      const x = ctx.width * fx
      const y = ctx.height * fy
      let minDist = Infinity
      for (const d of reds) {
        const dist = Math.abs(
          (y - d.laser.originY) * d.laser.dirX -
            (x - d.laser.originX) * d.laser.dirY,
        )
        minDist = Math.min(minDist, dist)
      }
      if (minDist > best.score) best = { x, y, score: minDist }
    }
    return { x: best.x, y: best.y }
  }

  selectLaserDirection(waveIndex: number): DroneEdge[] {
    const script: DroneEdge[][] = [
      ['left', 'right'],
      ['top', 'bottom'],
      ['left', 'right'],
      ['top', 'bottom', 'left'],
      ['top', 'bottom', 'left', 'right'],
      ['left', 'right', 'top'],
      ['top', 'bottom', 'left', 'right'],
      ['top', 'bottom', 'left', 'right'],
    ]
    return script[Math.min(waveIndex, script.length - 1)]!
  }

  activateLaserLine(edge: DroneEdge, ctx: EventContext): void {
    const cfg = EVENTS.bulletHell
    this.drones.push(
      SniperDrone.spawnOnEdge(
        edge,
        ctx.width,
        ctx.height,
        ctx.player.x,
        ctx.player.y,
        {
          trackDuration: cfg.trackDuration,
          lockDuration: cfg.lockDuration,
        },
        'red',
      ),
    )
  }

  private impactFx(ctx: EventContext, drone: SniperDrone): void {
    const line = drone.laser.getArenaLine(ctx.width, ctx.height)
    const yellow = drone.tint === 'yellow'
    const mx = (line.x1 + line.x2) * 0.5
    const my = (line.y1 + line.y2) * 0.5
    ctx.particles.flash = Math.max(ctx.particles.flash, yellow ? 0.5 : 0.4)
    ctx.particles.shake = Math.max(ctx.particles.shake, yellow ? 0.4 : 0.32)
    ctx.particles.shakeMag = Math.max(ctx.particles.shakeMag, yellow ? 11 : 9)
    ctx.particles.emitCollect(mx, my, 5, yellow ? '#fbbf24' : '#ff6b6b')
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6
      ctx.particles.emitCollect(
        line.x1 + (line.x2 - line.x1) * t,
        line.y1 + (line.y2 - line.y1) * t,
        1,
        yellow
          ? i % 2 === 0
            ? '#facc15'
            : '#ffffff'
          : i % 2 === 0
            ? '#ff4444'
            : '#ffffff',
      )
    }
  }

  protected exit(_ctx: EventContext): void {
    this.drones = []
  }
}
