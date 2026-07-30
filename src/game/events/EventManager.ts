import { EVENTS } from '../constants'
import { randomRange } from '@/utils/random'
import { BaseEvent } from './BaseEvent'
import { BerserkEvent } from './BerserkEvent'
import { BulletHellEvent } from './BulletHellEvent'
import { ChainExplosionEvent } from './ChainExplosionEvent'
import { CrossfireEvent } from './CrossfireEvent'
import { EnergyWallsEvent } from './EnergyWallsEvent'
import {
  EVENT_LABELS,
  type EventContext,
  type EventId,
  type EventVisuals,
} from './EventContext'
import { PhaseShiftEvent } from './PhaseShiftEvent'
import { RadarEvent } from './RadarEvent'
import { ShockwaveEvent } from './ShockwaveEvent'
import { SniperEvent } from './SniperEvent'
import type { Orb } from '../Orb'

type Factory = () => BaseEvent

const FACTORIES: Record<EventId, Factory> = {
  energyWalls: () => new EnergyWallsEvent(),
  shockwave: () => new ShockwaveEvent(),
  berserk: () => new BerserkEvent(),
  chainExplosion: () => new ChainExplosionEvent(),
  sniper: () => new SniperEvent(),
  phaseShift: () => new PhaseShiftEvent(),
  radar: () => new RadarEvent(),
  crossfire: () => new CrossfireEvent(),
  bulletHell: () => new BulletHellEvent(),
}

const UNLOCK: Record<EventId, number> = {
  energyWalls: EVENTS.energyWalls.unlockStage,
  shockwave: EVENTS.shockwave.unlockStage,
  berserk: EVENTS.berserk.unlockStage,
  chainExplosion: EVENTS.chainExplosion.unlockStage,
  sniper: EVENTS.sniper.unlockStage,
  phaseShift: EVENTS.phaseShift.unlockStage,
  radar: EVENTS.radar.unlockStage,
  crossfire: EVENTS.crossfire.unlockStage,
  bulletHell: EVENTS.bulletHell.unlockStage,
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

  /** Radar — no new enemies while visibility is limited. */
  get blocksEnemySpawns(): boolean {
    return this.activeId === 'radar'
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
    const energy =
      id === 'energyWalls' && this.active instanceof EnergyWallsEvent
        ? {
            intensity: fade,
            time: this.active.time,
            x: 0,
            y: 0,
            w: ctx.width,
            h: ctx.height,
            impact: { ...this.active.impact },
          }
        : null
    const shockwave =
      id === 'shockwave' && this.active instanceof ShockwaveEvent
        ? {
            intensity: fade,
            waves: this.active.getWaveVisuals(fade),
          }
        : null
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
    const phaseShift =
      id === 'phaseShift' && this.active instanceof PhaseShiftEvent
        ? { intensity: fade }
        : null
    const radar =
      id === 'radar' && this.active instanceof RadarEvent
        ? this.active.getVisuals(fade, ctx)
        : null
    const crossfire =
      id === 'crossfire' && this.active instanceof CrossfireEvent
        ? this.active.getVisuals(fade, ctx.width, ctx.height)
        : null
    const bulletHell =
      id === 'bulletHell' && this.active instanceof BulletHellEvent
        ? this.active.getVisuals(fade, ctx.width, ctx.height)
        : null

    return {
      activeEvent: id,
      eventLabel: this.activeLabel,
      fade,
      energyWalls: energy,
      shockwave,
      chainExplosion,
      sniper,
      phaseShift,
      radar,
      crossfire,
      bulletHell,
    }
  }

  private unlockedIds(stage: number): EventId[] {
    return (Object.keys(UNLOCK) as EventId[]).filter(
      (id) => stage >= UNLOCK[id],
    )
  }
}
