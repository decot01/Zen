import { EVENTS } from '../constants'
import { clamp } from '@/utils/math'
import { BaseEvent } from './BaseEvent'
import type { EventContext, EventId } from './EventContext'
import type { Enemy } from '../Enemy'
import type { Orb } from '../Orb'

interface RadarPulse {
  x: number
  y: number
  radius: number
  speed: number
  maxRadius: number
  alive: boolean
  /** Entities already tagged by this pulse. */
  hit: WeakSet<object>
  sparkAcc: number
}

export interface RadarVisual {
  intensity: number
  darkness: number
  playerX: number
  playerY: number
  pulses: { x: number; y: number; radius: number; alpha: number }[]
}

/**
 * Periodic radar scans reveal enemies/orbs briefly in a darkened arena.
 * Visibility-only — no AI / physics / score changes.
 */
export class RadarEvent extends BaseEvent {
  readonly id: EventId = 'radar'
  readonly duration = EVENTS.radar.duration

  private pulseTimer = 0
  private pulsesFired = 0
  private pulses: RadarPulse[] = []
  private enemyReveal = new WeakMap<Enemy, number>()
  private orbReveal = new WeakMap<Orb, number>()
  private darkness = 0

  enter(ctx: EventContext): void {
    super.enter(ctx)
    this.pulseTimer = EVENTS.radar.interval
    this.pulsesFired = 0
    this.pulses = []
    this.enemyReveal = new WeakMap()
    this.orbReveal = new WeakMap()
    this.darkness = 0
    this.resetVisibility(ctx)
    ctx.audio.playRadarStart()
    // First ping shortly after enter so the player gets a read quickly.
    this.startRadarPulse(ctx)
    this.pulsesFired = 1
  }

  getVisuals(intensity: number, ctx: EventContext): RadarVisual {
    return {
      intensity,
      darkness: this.darkness * intensity * EVENTS.radar.maxDarkness,
      playerX: ctx.player.x,
      playerY: ctx.player.y,
      pulses: this.pulses
        .filter((p) => p.alive)
        .map((p) => ({
          x: p.x,
          y: p.y,
          radius: p.radius,
          alpha: clamp(1 - p.radius / p.maxRadius, 0.15, 1) * intensity,
        })),
    }
  }

  protected onUpdate(dt: number, ctx: EventContext): void {
    if (ctx.dying) return

    const cfg = EVENTS.radar
    const targetDark = this.exiting ? 0 : 1
    this.darkness += (targetDark - this.darkness) * (1 - Math.exp(-3 * dt))

    this.applyRadarVisibility(dt, ctx)

    for (const pulse of this.pulses) {
      if (!pulse.alive) continue
      pulse.radius += pulse.speed * dt
      this.revealObjects(pulse, ctx)
      pulse.sparkAcc += dt
      if (pulse.sparkAcc >= 0.07) {
        pulse.sparkAcc = 0
        ctx.particles.emitRadarRing(pulse.x, pulse.y, pulse.radius, 5)
      }
      if (pulse.radius >= pulse.maxRadius) pulse.alive = false
    }
    this.pulses = this.pulses.filter((p) => p.alive)

    if (this.exiting) return

    if (this.pulsesFired >= cfg.maxPulses) {
      if (this.pulses.length === 0) this.beginExit(ctx)
      return
    }

    this.pulseTimer -= dt
    if (this.pulseTimer > 0) return

    this.startRadarPulse(ctx)
    this.pulsesFired += 1
    if (this.pulsesFired < cfg.maxPulses) {
      this.pulseTimer = cfg.interval
    }
  }

  startRadarPulse(ctx: EventContext): void {
    const cfg = EVENTS.radar
    const maxRadius = Math.hypot(ctx.width, ctx.height) * 0.72
    this.pulses.push({
      x: ctx.player.x,
      y: ctx.player.y,
      radius: 8,
      speed: maxRadius / cfg.pulseTravel,
      maxRadius,
      alive: true,
      hit: new WeakSet(),
      sparkAcc: 0,
    })
    ctx.audio.playRadarPulse()
    ctx.particles.emitRadarRing(ctx.player.x, ctx.player.y, 12, 10)
  }

  revealObjects(pulse: RadarPulse, ctx: EventContext): void {
    const revealT = EVENTS.radar.revealDuration

    for (const e of ctx.enemies) {
      if (!e.alive || pulse.hit.has(e)) continue
      const d = Math.hypot(e.x - pulse.x, e.y - pulse.y)
      if (d > pulse.radius + e.radius) continue
      pulse.hit.add(e)
      this.enemyReveal.set(e, revealT)
      e.radarReveal = 1
    }

    for (const o of ctx.orbs) {
      if (!o.alive || pulse.hit.has(o)) continue
      const d = Math.hypot(o.x - pulse.x, o.y - pulse.y)
      if (d > pulse.radius + o.radius) continue
      pulse.hit.add(o)
      this.orbReveal.set(o, revealT)
      o.radarReveal = 1
    }
  }

  applyRadarVisibility(dt: number, ctx: EventContext): void {
    const active = this.fade > 0.05 && !this.exiting

    for (const e of ctx.enemies) {
      if (!e.alive) {
        e.radarReveal = 0
        e.radarDim = 0
        continue
      }
      let left = this.enemyReveal.get(e) ?? 0
      if (left > 0) {
        left = Math.max(0, left - dt)
        this.enemyReveal.set(e, left)
        e.radarReveal = left > 0.35 ? 1 : clamp(left / 0.35, 0, 1)
      } else {
        e.radarReveal = 0
      }
      e.radarDim = active ? 1 : 0
    }

    for (const o of ctx.orbs) {
      if (!o.alive) {
        o.radarReveal = 0
        o.radarDim = 0
        continue
      }
      let left = this.orbReveal.get(o) ?? 0
      if (left > 0) {
        left = Math.max(0, left - dt)
        this.orbReveal.set(o, left)
        o.radarReveal = left > 0.35 ? 1 : clamp(left / 0.35, 0, 1)
      } else {
        o.radarReveal = 0
      }
      o.radarDim = active ? 1 : 0
    }
  }

  resetVisibility(ctx: EventContext): void {
    for (const e of ctx.enemies) {
      e.radarReveal = 0
      e.radarDim = 0
    }
    for (const o of ctx.orbs) {
      o.radarReveal = 0
      o.radarDim = 0
    }
  }

  protected onBeginExit(_ctx: EventContext): void {
    this.pulses = []
  }

  protected exit(ctx: EventContext): void {
    this.pulses = []
    this.resetVisibility(ctx)
  }
}
