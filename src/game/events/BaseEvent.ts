import { EVENTS } from '../constants'
import type { EventContext, EventId } from './EventContext'

export abstract class BaseEvent {
  abstract readonly id: EventId
  abstract readonly duration: number

  protected age = 0
  protected exiting = false
  protected exitAge = 0
  private finished = false

  get done(): boolean {
    return this.finished
  }

  /** 0→1 fade for visuals (enter + hold + exit). */
  get fade(): number {
    const fadeIn = EVENTS.fadeIn
    const fadeOut = EVENTS.fadeOut
    if (this.exiting) {
      return Math.max(0, 1 - this.exitAge / fadeOut)
    }
    if (this.age < fadeIn) return this.age / fadeIn
    return 1
  }

  /** Normalized progress through main duration (ignores fade-out). */
  get progress(): number {
    return Math.min(1, this.age / this.duration)
  }

  enter(_ctx: EventContext): void {
    this.age = 0
    this.exiting = false
    this.exitAge = 0
    this.finished = false
  }

  update(dt: number, ctx: EventContext): void {
    if (this.finished) return

    if (this.exiting) {
      this.exitAge += dt
      this.onUpdate(dt, ctx)
      if (this.exitAge >= EVENTS.fadeOut) {
        this.exit(ctx)
        this.finished = true
      }
      return
    }

    this.age += dt
    this.onUpdate(dt, ctx)

    if (this.age >= this.duration) {
      this.beginExit(ctx)
    }
  }

  /** Soft end — plays fade-out then exit(). */
  beginExit(ctx: EventContext): void {
    if (this.exiting || this.finished) return
    this.exiting = true
    this.exitAge = 0
    this.onBeginExit(ctx)
  }

  /** Immediate teardown (death / reset / black hole interrupt). */
  forceEnd(ctx: EventContext): void {
    if (this.finished) return
    this.exit(ctx)
    this.finished = true
  }

  onOrbCollected(_orb: import('../Orb').Orb, _ctx: EventContext): void {}

  protected onUpdate(_dt: number, _ctx: EventContext): void {}
  protected onBeginExit(_ctx: EventContext): void {}
  protected abstract exit(ctx: EventContext): void
}
