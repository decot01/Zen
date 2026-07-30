import { EVENTS } from '../constants'
import { BaseEvent } from './BaseEvent'
import type { EventContext, EventId } from './EventContext'
import type { SniperVisual } from './SniperEvent'
import { SniperDrone, type DroneEdge } from './SniperDrone'

export type CrossfireVisual = SniperVisual

/**
 * Multi-edge sniper barrage — reuses LaserAttack / SniperDrone / sniper FX.
 */
export class CrossfireEvent extends BaseEvent {
  readonly id: EventId = 'crossfire'
  readonly duration = EVENTS.crossfire.duration

  private waves = 0
  private waveTimer = 0.4
  private drones: SniperDrone[] = []

  enter(ctx: EventContext): void {
    super.enter(ctx)
    this.waves = 0
    this.waveTimer = 0.4
    this.drones = []
    ctx.audio.playSniperStart()
  }

  getVisuals(intensity: number, width: number, height: number): CrossfireVisual {
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
    return { intensity: Math.min(1, intensity * 1.12), drones, lasers }
  }

  protected onUpdate(dt: number, ctx: EventContext): void {
    if (ctx.dying) {
      this.drones = []
      return
    }

    let anyFired = false
    let anyLocked = false
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
      if (justLocked) anyLocked = true
      if (justFired) {
        anyFired = true
        if (
          drone.laser.checkHit(ctx.player.x, ctx.player.y, ctx.player.radius)
        ) {
          hit = true
        }
        this.impactFx(ctx, drone)
      }
    }

    if (anyLocked) ctx.audio.playSniperLock()
    if (anyFired) ctx.audio.playSniperFire()

    this.drones = this.drones.filter((d) => !d.done)

    if (hit) {
      ctx.killPlayer()
      return
    }

    if (this.exiting) return

    const cfg = EVENTS.crossfire
    if (this.waves >= cfg.maxWaves) {
      if (this.drones.length === 0) this.beginExit(ctx)
      return
    }

    // Wait for current wave to finish before arming the next.
    if (this.drones.length > 0) return

    this.waveTimer -= dt
    if (this.waveTimer > 0) return

    this.createCrossfirePattern(ctx)
    this.waves += 1
    const t = this.waves / Math.max(1, cfg.maxWaves)
    this.waveTimer =
      cfg.intervalEarly + (cfg.intervalLate - cfg.intervalEarly) * t
  }

  createCrossfirePattern(ctx: EventContext): void {
    const edges = this.selectLaserDirection(this.waves)
    for (const edge of edges) {
      this.activateLaserLine(edge, ctx)
    }
    ctx.audio.playSniperSpawn()
  }

  selectLaserDirection(waveIndex: number): DroneEdge[] {
    // Scripted escalation — readable, not random.
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
    const cfg = EVENTS.crossfire
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
      ),
    )
  }

  private impactFx(ctx: EventContext, drone: SniperDrone): void {
    const line = drone.laser.getArenaLine(ctx.width, ctx.height)
    const mx = (line.x1 + line.x2) * 0.5
    const my = (line.y1 + line.y2) * 0.5
    ctx.particles.flash = Math.max(ctx.particles.flash, 0.4)
    ctx.particles.shake = Math.max(ctx.particles.shake, 0.32)
    ctx.particles.shakeMag = Math.max(ctx.particles.shakeMag, 9)
    ctx.particles.emitCollect(mx, my, 5, '#ff6b6b')
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6
      ctx.particles.emitCollect(
        line.x1 + (line.x2 - line.x1) * t,
        line.y1 + (line.y2 - line.y1) * t,
        1,
        i % 2 === 0 ? '#ff4444' : '#ffffff',
      )
    }
  }

  protected exit(_ctx: EventContext): void {
    this.drones = []
  }
}
