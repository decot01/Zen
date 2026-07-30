import { EVENTS } from '../constants'
import { clamp } from '@/utils/math'
import { LaserAttack, type LaserTiming } from './LaserAttack'

export type DroneEdge = 'top' | 'bottom' | 'left' | 'right'
export type LaserTint = 'red' | 'yellow'

/**
 * Small red-eyed drone that appears outside the arena and owns one LaserAttack.
 */
export class SniperDrone {
  x: number
  y: number
  edge: DroneEdge
  laser: LaserAttack
  tint: LaserTint
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
    tint: LaserTint = 'red',
  ) {
    this.x = x
    this.y = y
    this.edge = edge
    this.tint = tint
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
    tint: LaserTint = 'red',
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
    return new SniperDrone(x, y, edge, aimX, aimY, timing, tint)
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
      this.appear = clamp(this.appear + dt * this.enterSpeed, 0, 1)
    }

    const signals = this.laser.update(
      dt,
      playerX,
      playerY,
      playerVx,
      playerVy,
    )

    if (this.laser.phase === 'done' && !this.leaving) {
      this.leaving = true
      this.leaveAge = 0
    }

    if (this.leaving) {
      this.leaveAge += dt
      const t = this.leaveAge / EVENTS.sniper.leaveDuration
      this.appear = clamp(1 - t, 0, 1)
      // Drift outward.
      const out =
        this.edge === 'top'
          ? { x: 0, y: -1 }
          : this.edge === 'bottom'
            ? { x: 0, y: 1 }
            : this.edge === 'left'
              ? { x: -1, y: 0 }
              : { x: 1, y: 0 }
      this.x += out.x * 90 * dt
      this.y += out.y * 90 * dt
      this.laser.originX = this.x
      this.laser.originY = this.y
      if (t >= 1) this.done = true
    }

    return signals
  }
}
