import { PLAYER } from './constants'
import { clamp, length, normalize } from '@/utils/math'

export interface Vec2 {
  x: number
  y: number
}

/**
 * Spring-like attraction toward a target with capped acceleration and damping.
 * Holding attracts; releasing coasts with lighter damping (inertia).
 */
export function applyAttraction(
  position: Vec2,
  velocity: Vec2,
  target: Vec2 | null,
  dt: number,
  attractStrength: number,
  maxSpeed: number,
): void {
  if (target) {
    const dx = target.x - position.x
    const dy = target.y - position.y
    const dist = length(dx, dy)
    if (dist > 1) {
      const dir = normalize(dx, dy)
      // Soften near target to avoid jitter
      const falloff = clamp(dist / 80, 0.25, 1)
      velocity.x += dir.x * attractStrength * falloff * dt
      velocity.y += dir.y * attractStrength * falloff * dt
    }
  }

  const damping = target ? PLAYER.damping : PLAYER.releaseDamping
  const dampFactor = Math.exp(-damping * dt)
  velocity.x *= dampFactor
  velocity.y *= dampFactor

  const speed = length(velocity.x, velocity.y)
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed
    velocity.x *= scale
    velocity.y *= scale
  }

  position.x += velocity.x * dt
  position.y += velocity.y * dt
}

/** Soft wall bounce keeping the orb inside the playfield. */
export function applyWallBounce(
  position: Vec2,
  velocity: Vec2,
  radius: number,
  width: number,
  height: number,
  bounce: number = PLAYER.wallBounce,
): void {
  if (position.x < radius) {
    position.x = radius
    velocity.x = Math.abs(velocity.x) * bounce
  } else if (position.x > width - radius) {
    position.x = width - radius
    velocity.x = -Math.abs(velocity.x) * bounce
  }

  if (position.y < radius) {
    position.y = radius
    velocity.y = Math.abs(velocity.y) * bounce
  } else if (position.y > height - radius) {
    position.y = height - radius
    velocity.y = -Math.abs(velocity.y) * bounce
  }
}

/** Stretch factor based on current speed (0 = circle, 1 = max stretch). */
export function stretchFromSpeed(speed: number): number {
  return clamp(speed / PLAYER.stretchSpeedRef, 0, 1) * PLAYER.stretchMax
}
