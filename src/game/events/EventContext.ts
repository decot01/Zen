import type { GameAudio } from '../Audio'
import type { Enemy } from '../Enemy'
import type { Orb } from '../Orb'
import type { ParticleSystem } from '../Particles'
import type { Player } from '../Player'
import type { ShockwaveVisual } from './ShockwaveEvent'
import type { SniperVisual } from './SniperEvent'

export type EventId =
  | 'energyWalls'
  | 'shockwave'
  | 'berserk'
  | 'chainExplosion'
  | 'sniper'

export const EVENT_LABELS: Record<EventId, string> = {
  energyWalls: 'Energy Walls',
  shockwave: 'Shockwave',
  berserk: 'Berserk',
  chainExplosion: 'Chain Explosion',
  sniper: 'Sniper',
}

export interface PlayBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** Shared mutable world access for events — owned by Game. */
export interface EventContext {
  dt: number
  elapsed: number
  difficultyTicks: number
  width: number
  height: number
  bounds: PlayBounds
  player: Player
  orbs: Orb[]
  enemies: Enemy[]
  particles: ParticleSystem
  audio: GameAudio
  findOrbSpawn: (
    excludeOrb?: Orb | null,
    extraPlayerSafe?: number,
  ) => { x: number; y: number } | null
  findSpawn: (extraPlayerSafe?: number) => { x: number; y: number } | null
  spawnEnemyAt: (x: number, y: number) => Enemy | null
  setTargetEnemyCount: (n: number) => void
  addScore: (points: number) => void
  /** Allow temporary speed above maxSpeed for wall bounce. */
  applyPlayerImpulse: (vx: number, vy: number, maxSpeed?: number) => void
  killPlayer: () => void
  /** True once a death sequence has started (skip event refill, etc.). */
  dying: boolean
}

export interface EventVisuals {
  activeEvent: EventId | null
  eventLabel: string | null
  fade: number
  energyWalls: {
    intensity: number
    time: number
    /** Screen-edge frame rect. */
    x: number
    y: number
    w: number
    h: number
    /** 0→1 impact strength per side (ball bounce reaction). */
    impact: { left: number; right: number; top: number; bottom: number }
  } | null
  shockwave: {
    intensity: number
    waves: ShockwaveVisual[]
  } | null
  chainExplosion: {
    intensity: number
    vignette: number
  } | null
  sniper: SniperVisual | null
}
