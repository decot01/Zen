import { EVENTS } from '../constants'
import { BaseEvent } from './BaseEvent'
import type { EventContext, EventId } from './EventContext'
import type { LaserLine } from './LaserAttack'
import { SniperDrone } from './SniperDrone'

export interface SniperVisual {
  intensity: number
  drones: {
    x: number
    y: number
    appear: number
    edge: SniperDrone['edge']
  }[]
  lasers: {
    line: LaserLine
    phase: 'tracking' | 'locked' | 'firing'
    warningPulse: number
    trackingProgress: number
    lockProgress: number
    fireFlash: number
  }[]
}

/**
 * High-tension dodge event: drones lock a laser on the player, then fire.
 */
export class SniperEvent extends BaseEvent {
  readonly id: EventId = 'sniper'
  readonly duration = EVENTS.sniper.duration

  private shots = 0
  private spawnTimer = 0.35
  private drone: SniperDrone | null = null

  enter(ctx: EventContext): void {
    super.enter(ctx)
    this.shots = 0
    this.spawnTimer = 0.35
    this.drone = null
    ctx.audio.playSniperStart()
  }

  getVisuals(intensity: number, width: number, height: number): SniperVisual {
    const drones: SniperVisual['drones'] = []
    const lasers: SniperVisual['lasers'] = []
    if (this.drone && !this.drone.done) {
      drones.push({
        x: this.drone.x,
        y: this.drone.y,
        appear: this.drone.appear,
        edge: this.drone.edge,
      })
      const laser = this.drone.laser
      if (laser.phase !== 'done') {
        lasers.push({
          line: laser.getArenaLine(width, height),
          phase: laser.phase,
          warningPulse: laser.warningPulse,
          trackingProgress: laser.trackingProgress,
          lockProgress: laser.lockProgress,
          fireFlash: laser.fireFlash,
        })
      }
    }
    return { intensity, drones, lasers }
  }

  protected onUpdate(dt: number, ctx: EventContext): void {
    if (ctx.dying) return

    if (this.drone) {
      const { justLocked, justFired } = this.drone.update(
        dt,
        ctx.player.x,
        ctx.player.y,
        ctx.player.vx,
        ctx.player.vy,
      )

      if (justLocked) ctx.audio.playSniperLock()

      if (justFired) {
        const hit = this.drone.laser.checkHit(
          ctx.player.x,
          ctx.player.y,
          ctx.player.radius,
        )
        ctx.audio.playSniperFire()
        this.impactFx(ctx)
        if (hit) {
          ctx.killPlayer()
          return
        }
      }

      if (this.drone.done) {
        this.drone = null
        this.shots += 1
        if (this.shots >= EVENTS.sniper.maxShots) {
          this.beginExit(ctx)
          return
        }
      }
    }

    if (this.exiting) return
    if (this.shots >= EVENTS.sniper.maxShots) {
      if (!this.drone) this.beginExit(ctx)
      return
    }

    // Cadence keeps ticking so shots stay ~3s apart even while a drone is active.
    this.spawnTimer -= dt
    if (this.drone || this.spawnTimer > 0) return

    this.drone = SniperDrone.spawn(
      ctx.width,
      ctx.height,
      ctx.player.x,
      ctx.player.y,
    )
    this.spawnTimer = EVENTS.sniper.interval
    ctx.audio.playSniperSpawn()
  }

  private impactFx(ctx: EventContext): void {
    const laser = this.drone?.laser
    if (!laser) return
    const line = laser.getArenaLine(ctx.width, ctx.height)
    const mx = (line.x1 + line.x2) * 0.5
    const my = (line.y1 + line.y2) * 0.5
    ctx.particles.flash = Math.max(ctx.particles.flash, 0.35)
    ctx.particles.shake = Math.max(ctx.particles.shake, 0.28)
    ctx.particles.shakeMag = Math.max(ctx.particles.shakeMag, 8)
    ctx.particles.emitCollect(mx, my, 4, '#ff6b6b')
    ctx.particles.emitCollect(ctx.player.x, ctx.player.y, 2, '#ffffff')
    // Sparks along the beam.
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5
      ctx.particles.emitCollect(
        line.x1 + (line.x2 - line.x1) * t,
        line.y1 + (line.y2 - line.y1) * t,
        1,
        i % 2 === 0 ? '#ff4444' : '#ffffff',
      )
    }
  }

  protected exit(_ctx: EventContext): void {
    this.drone = null
  }
}
