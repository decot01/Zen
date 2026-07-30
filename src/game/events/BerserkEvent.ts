import { EVENTS } from '../constants'
import type { Enemy } from '../Enemy'
import { BaseEvent } from './BaseEvent'
import type { EventContext, EventId } from './EventContext'

export class BerserkEvent extends BaseEvent {
  readonly id: EventId = 'berserk'
  readonly duration = EVENTS.berserk.duration
  private target: Enemy | null = null
  private trailAccum = 0

  enter(ctx: EventContext): void {
    super.enter(ctx)
    const candidates = ctx.enemies.filter((e) => e.alive)
    if (candidates.length === 0) {
      this.beginExit(ctx)
      return
    }
    this.target = candidates[Math.floor(Math.random() * candidates.length)]!
    this.target.setBerserk(true)
    this.trailAccum = 0
    ctx.audio.playEventBerserk()
  }

  protected onUpdate(dt: number, ctx: EventContext): void {
    if (!this.target || !this.target.alive) {
      this.beginExit(ctx)
      return
    }
    this.trailAccum += dt
    if (this.trailAccum >= 0.045) {
      this.trailAccum = 0
      ctx.particles.emitBerserkTrail(this.target.x, this.target.y)
    }
  }

  protected exit(_ctx: EventContext): void {
    if (this.target) {
      this.target.setBerserk(false)
      this.target = null
    }
  }
}
