import { EVENTS, PLAYER } from '../constants'
import { BaseEvent } from './BaseEvent'
import type { EventContext, EventId } from './EventContext'

type WallSide = 'left' | 'right' | 'top' | 'bottom'

export class EnergyWallsEvent extends BaseEvent {
  readonly id: EventId = 'energyWalls'
  readonly duration = EVENTS.energyWalls.duration
  time = 0
  impact = { left: 0, right: 0, top: 0, bottom: 0 }

  enter(ctx: EventContext): void {
    super.enter(ctx)
    this.time = 0
    this.impact = { left: 0, right: 0, top: 0, bottom: 0 }
    ctx.audio.playEnergyWallsStart()
  }

  protected onUpdate(dt: number, ctx: EventContext): void {
    this.time += dt
    this.decayImpact(dt)

    const intensity = this.fade
    if (intensity <= 0.01) return

    const open = Math.min(1, this.time / EVENTS.energyWalls.openDuration)
    if (open < 0.55) return

    const {
      bandWidth,
      pushStrength,
      pushMaxSpeed,
      borderThickness,
      bounceKick,
    } = EVENTS.energyWalls
    const p = ctx.player
    const contact = PLAYER.radius + borderThickness
    const kick = bounceKick * intensity
    const power = intensity * (0.55 + 0.45 * open)
    let pushX = 0
    let pushY = 0

    const leftDist = p.x - contact
    if (leftDist < bandWidth) {
      const t = 1 - Math.max(0, leftDist) / bandWidth
      pushX += pushStrength * t * t * power
      if (leftDist < bandWidth * 0.5 && p.vx < kick * 0.4) {
        p.vx = Math.max(-p.vx * 1.4, kick)
        if (p.noteWallImpact()) this.hit('left', ctx)
      }
    }
    const rightDist = ctx.width - contact - p.x
    if (rightDist < bandWidth) {
      const t = 1 - Math.max(0, rightDist) / bandWidth
      pushX -= pushStrength * t * t * power
      if (rightDist < bandWidth * 0.5 && p.vx > -kick * 0.4) {
        p.vx = Math.min(-p.vx * 1.4, -kick)
        if (p.noteWallImpact()) this.hit('right', ctx)
      }
    }
    const topDist = p.y - contact
    if (topDist < bandWidth) {
      const t = 1 - Math.max(0, topDist) / bandWidth
      pushY += pushStrength * t * t * power
      if (topDist < bandWidth * 0.5 && p.vy < kick * 0.4) {
        p.vy = Math.max(-p.vy * 1.4, kick)
        if (p.noteWallImpact()) this.hit('top', ctx)
      }
    }
    const bottomDist = ctx.height - contact - p.y
    if (bottomDist < bandWidth) {
      const t = 1 - Math.max(0, bottomDist) / bandWidth
      pushY -= pushStrength * t * t * power
      if (bottomDist < bandWidth * 0.5 && p.vy > -kick * 0.4) {
        p.vy = Math.min(-p.vy * 1.4, -kick)
        if (p.noteWallImpact()) this.hit('bottom', ctx)
      }
    }

    if (pushX !== 0 || pushY !== 0) {
      ctx.applyPlayerImpulse(pushX * dt, pushY * dt, pushMaxSpeed)
    }
  }

  private hit(side: WallSide, ctx: EventContext): void {
    this.impact[side] = 1
    ctx.audio.playEnergyWallHit()
    ctx.particles.shake = Math.max(ctx.particles.shake, 0.07)
    ctx.particles.shakeMag = 2
    ctx.particles.flash = Math.max(ctx.particles.flash, 0.04)

    const p = ctx.player
    const t = EVENTS.energyWalls.borderThickness
    let sx = p.x
    let sy = p.y
    if (side === 'left') sx = t
    if (side === 'right') sx = ctx.width - t
    if (side === 'top') sy = t
    if (side === 'bottom') sy = ctx.height - t
    ctx.particles.emitCollect(sx, sy, 1, '#ffffff')
  }

  private decayImpact(dt: number): void {
    const rate = dt / EVENTS.energyWalls.impactDuration
    this.impact.left = Math.max(0, this.impact.left - rate)
    this.impact.right = Math.max(0, this.impact.right - rate)
    this.impact.top = Math.max(0, this.impact.top - rate)
    this.impact.bottom = Math.max(0, this.impact.bottom - rate)
  }

  protected exit(_ctx: EventContext): void {}
}
