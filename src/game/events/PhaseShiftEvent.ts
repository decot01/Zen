import { EVENTS } from '../constants'
import { randomRange } from '@/utils/random'
import type { Enemy } from '../Enemy'
import { BaseEvent } from './BaseEvent'
import type { EventContext, EventId } from './EventContext'

/**
 * Temporarily phases a fraction of enemies — safe corridors open and close.
 */
export class PhaseShiftEvent extends BaseEvent {
  readonly id: EventId = 'phaseShift'
  readonly duration = EVENTS.phaseShift.duration

  private group: Enemy[] = []
  private groupAge = 0
  private particleAccum = 0

  enter(ctx: EventContext): void {
    super.enter(ctx)
    this.group = []
    this.groupAge = 0
    this.particleAccum = 0
    ctx.audio.playPhaseShift()
    this.pickGroup(ctx)
  }

  protected onUpdate(dt: number, ctx: EventContext): void {
    if (ctx.dying) return

    // Smooth visual blend lives on enemies; keep particles + timers here.
    for (const e of ctx.enemies) {
      if (e.alive) e.updatePhaseVisual(dt)
    }

    if (this.exiting) {
      this.clearGroup(ctx, false)
      return
    }

    this.groupAge += dt
    this.particleAccum += dt

    const cfg = EVENTS.phaseShift
    if (this.particleAccum >= cfg.particleInterval) {
      this.particleAccum = 0
      for (const e of this.group) {
        if (!e.alive || !e.phased) continue
        const ang = randomRange(0, Math.PI * 2)
        const dist = e.radius * (0.6 + Math.random() * 0.9)
        const color = Math.random() > 0.45 ? '#a78bfa' : '#60a5fa'
        ctx.particles.emitCollect(
          e.x + Math.cos(ang) * dist,
          e.y + Math.sin(ang) * dist,
          1,
          color,
        )
      }
    }

    if (this.groupAge >= cfg.interval) {
      this.clearGroup(ctx, true)
      this.pickGroup(ctx)
    }
  }

  protected onBeginExit(ctx: EventContext): void {
    this.clearGroup(ctx, true)
  }

  protected exit(ctx: EventContext): void {
    for (const e of ctx.enemies) {
      if (e.phased) e.setPhased(false)
      e.phaseAmount = 0
    }
    this.group = []
  }

  private pickGroup(ctx: EventContext): void {
    this.groupAge = 0

    const candidates = ctx.enemies.filter((e) => e.alive && e.armed)
    const cfg = EVENTS.phaseShift
    if (candidates.length <= cfg.minLethal) {
      this.group = []
      return
    }

    const maxPhase = candidates.length - cfg.minLethal
    const want = Math.round(candidates.length * cfg.fraction)
    const count = Math.min(maxPhase, Math.max(0, want))
    if (count <= 0) {
      this.group = []
      return
    }

    // Shuffle copy and take first `count`.
    const pool = [...candidates]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = pool[i]!
      pool[i] = pool[j]!
      pool[j] = tmp
    }
    this.group = pool.slice(0, count)

    for (const e of this.group) {
      e.setPhased(true)
      // Enter ripple.
      ctx.particles.emitCollect(e.x, e.y, 2, '#a78bfa')
      ctx.particles.emitCollect(e.x, e.y, 1, '#60a5fa')
    }
    if (this.group.length > 0) ctx.audio.playPhaseShift()
  }

  private clearGroup(ctx: EventContext, burst: boolean): void {
    for (const e of this.group) {
      if (!e.alive) continue
      if (burst && e.phased) {
        ctx.particles.emitCollect(e.x, e.y, 2, '#c4b5fd')
        ctx.particles.emitCollect(e.x, e.y, 1, '#ffffff')
      }
      e.setPhased(false)
    }
    this.group = []
  }
}
