import { EVENTS } from '../constants'
import { randomRange } from '@/utils/random'
import { BaseEvent } from './BaseEvent'
import { BerserkEvent } from './BerserkEvent'
import { ChainExplosionEvent } from './ChainExplosionEvent'
import {
  EVENT_LABELS,
  type EventContext,
  type EventId,
  type EventVisuals,
} from './EventContext'
import { SniperEvent } from './SniperEvent'
import type { Orb } from '../Orb'

type Factory = () => BaseEvent

const FACTORIES: Record<EventId, Factory> = {
  berserk: () => new BerserkEvent(),
  chainExplosion: () => new ChainExplosionEvent(),
  sniper: () => new SniperEvent(),
}

const UNLOCK: Record<EventId, number> = {
  berserk: EVENTS.berserk.unlockStage,
  chainExplosion: EVENTS.chainExplosion.unlockStage,
  sniper: EVENTS.sniper.unlockStage,
}

/** Schedules timed world events independent of difficulty ticks. */
export class EventManager {
  private active: BaseEvent | null = null
  private cooldown = 0
  private lastEventId: EventId | null = null
  private started = false

  reset(): void {
    this.active = null
    this.cooldown = randomRange(EVENTS.cooldownMin * 0.5, EVENTS.cooldownMax * 0.65)
    this.lastEventId = null
    this.started = false
  }

  get activeId(): EventId | null {
    return this.active && !this.active.done ? this.active.id : null
  }

  get activeLabel(): string | null {
    const id = this.activeId
    return id ? EVENT_LABELS[id] : null
  }

  get fade(): number {
    return this.active && !this.active.done ? this.active.fade : 0
  }

  forceEnd(ctx: EventContext): void {
    if (this.active && !this.active.done) {
      this.active.forceEnd(ctx)
    }
    this.active = null
  }

  update(dt: number, ctx: EventContext): void {
    if (this.active) {
      const current = this.active
      current.update(dt, ctx)
      if (current.done) {
        this.lastEventId = current.id
        if (this.active === current) this.active = null
        this.cooldown = randomRange(EVENTS.cooldownMin, EVENTS.cooldownMax)
      }
      return
    }

    const unlocked = this.unlockedIds(ctx.difficultyTicks)
    if (unlocked.length === 0) return

    if (!this.started) {
      this.started = true
      this.cooldown = randomRange(EVENTS.cooldownMin * 0.4, EVENTS.cooldownMax * 0.7)
    }

    this.cooldown -= dt
    if (this.cooldown > 0) return

    // Never pick the same event twice in a row.
    const pool = unlocked.filter((id) => id !== this.lastEventId)
    const choices = pool.length > 0 ? pool : unlocked
    const pick = choices[Math.floor(Math.random() * choices.length)]!
    this.active = FACTORIES[pick]()
    this.active.enter(ctx)
    if (this.active.done) {
      this.active = null
      this.cooldown = randomRange(EVENTS.cooldownMin, EVENTS.cooldownMax)
    }
  }

  onOrbCollected(orb: Orb, ctx: EventContext): void {
    if (!this.active || this.active.done) return
    this.active.onOrbCollected(orb, ctx)
  }

  getVisuals(ctx: EventContext): EventVisuals {
    const id = this.activeId
    const fade = this.fade
    const chainExplosion =
      id === 'chainExplosion' && this.active instanceof ChainExplosionEvent
        ? {
            intensity: fade,
            vignette: this.active.vignetteStrength,
          }
        : null
    const sniper =
      id === 'sniper' && this.active instanceof SniperEvent
        ? this.active.getVisuals(fade, ctx.width, ctx.height)
        : null

    return {
      activeEvent: id,
      eventLabel: this.activeLabel,
      fade,
      chainExplosion,
      sniper,
    }
  }

  private unlockedIds(stage: number): EventId[] {
    return (Object.keys(UNLOCK) as EventId[]).filter(
      (id) => stage >= UNLOCK[id],
    )
  }
}
