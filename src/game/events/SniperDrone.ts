import { EVENTS } from '../constants'
import { clamp } from '@/utils/math'
import { LaserAttack, type LaserTiming } from './LaserAttack'

export type DroneEdge = 'top' | 'bottom' | 'left' | 'right'

/**
 * Small red-eyed drone that appears outside the arena and owns one LaserAttack.
 */
export class SniperDrone {
  x: number
  y: number
  edge: DroneEdge
  laser: LaserAttack
  /** 0→1 enter, then leave after shot. */
  appear = 0
  leaving = false
  leaveAge = 0
  done = false
  private readonly enterSpeed = 6

  private constructor(
    x: number,
    y: number,
    edge: DroneEdge,
    aimX: number,
    aimY: number,
    timing?: LaserTiming,
  ) {
    this.x = x
    this.y = y
    this.edge = edge
    this.laser = new LaserAttack(x, y, aimX, aimY, timing)
  }

  static spawn(
    width: number,
    height: number,
    aimX: number,
    aimY: number,
  ): SniperDrone {
    const edge = (['top', 'bottom', 'left', 'right'] as const)[
      Math.floor(Math.random() * 4)
    ]!
    return SniperDrone.spawnOnEdge(edge, width, height, aimX, aimY)
  }

  /** Spawn a drone on a fixed arena edge, aimed at the player. */
  static spawnOnEdge(
    edge: DroneEdge,
    width: number,
    height: number,
    aimX: number,
    aimY: number,
    timing?: LaserTiming,
  ): SniperDrone {
    const m = EVENTS.sniper.droneMargin
    const pad = 0.12
    let x = 0
    let y = 0
    if (edge === 'top') {
      x = clamp(aimX, width * pad, width * (1 - pad))
      y = -m
    } else if (edge === 'bottom') {
      x = clamp(aimX, width * pad, width * (1 - pad))
      y = height + m
    } else if (edge === 'left') {
      x = -m
      y = clamp(aimY, height * pad, height * (1 - pad))
    } else {
      x = width + m
      y = clamp(aimY, height * pad, height * (1 - pad))
    }
    return new SniperDrone(x, y, edge, aimX, aimY, timing)
  }

  update(
    dt: number,
    playerX: number,
    playerY: number,
    playerVx = 0,
    playerVy = 0,
  ): { justLocked: boolean; justFired: boolean } {
    if (this.done) return { justLocked: false, justFired: false }

    if (!this.leaving) {
      this.appear = Math.min(1, this.appear + dt * this.enterSpeed)
    }

    const result = this.laser.update(dt, playerX, playerY, playerVx, playerVy)

    if (result.justFired) {
      this.leaving = true
    }

    if (this.leaving) {
      this.leaveAge += dt
      const t = this.leaveAge / EVENTS.sniper.leaveDuration
      this.appear = Math.max(0, 1 - t)
      if (t >= 1) this.done = true
    }

    return result
  }
}
