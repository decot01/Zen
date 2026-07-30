import { ENEMY, EVENTS } from '../constants'
import { distance } from '@/utils/math'
import { randomRange } from '@/utils/random'
import type { Enemy } from '../Enemy'
import { BaseEvent } from './BaseEvent'
import type { EventContext, EventId } from './EventContext'

/**
 * Spontaneous + chained enemy charges that explode with a readable blast radius.
 * Caps keep cascades cinematic but fair.
 */
export class ChainExplosionEvent extends BaseEvent {
  readonly id: EventId = 'chainExplosion'
  readonly duration = randomRange(
    EVENTS.chainExplosion.durationMin,
    EVENTS.chainExplosion.durationMax,
  )

  private pickTimer = 0
  /** Remaining explosions allowed in the current cascade. */
  private cascadeLeft = EVENTS.chainExplosion.maxChainExplosions
  private warnAccum = 0
  private vignette = 0

  enter(ctx: EventContext): void {
    super.enter(ctx)
    this.pickTimer = randomRange(0.35, 0.75)
    this.cascadeLeft = EVENTS.chainExplosion.maxChainExplosions
    this.warnAccum = 0
    this.vignette = 0
    ctx.audio.playEventWhoosh()
  }

  get vignetteStrength(): number {
    return this.vignette * this.fade
  }

  protected onUpdate(dt: number, ctx: EventContext): void {
    if (ctx.dying || this.fade < 0.04) return

    const cfg = EVENTS.chainExplosion
    const charging = this.chargingEnemies(ctx)

    // Soft vignette follows charge tension.
    const tension =
      charging.length === 0
        ? 0
        : charging.reduce((s, e) => s + e.chargeProgress, 0) /
          Math.max(1, charging.length)
    const targetV = 0.12 + tension * 0.55
    this.vignette += (targetV - this.vignette) * (1 - Math.exp(-6 * dt))

    // Advance charges + warning sparks.
    this.warnAccum += dt
    const emitWarn = this.warnAccum >= cfg.warnParticleInterval
    if (emitWarn) this.warnAccum = 0

    for (const e of [...charging]) {
      if (!e.alive || e.chargeT == null) continue
      e.chargeT = Math.min(1, e.chargeT + dt / cfg.chargeDuration)

      if (emitWarn) {
        const ang = randomRange(0, Math.PI * 2)
        const dist = e.radius * (0.8 + e.chargeProgress * 1.2)
        ctx.particles.emitCollect(
          e.x + Math.cos(ang) * dist,
          e.y + Math.sin(ang) * dist,
          1,
          e.chargeProgress > 0.55 ? '#ff6b6b' : '#fda4a4',
        )
      }

      if (e.chargeT >= 1) {
        if (this.explode(e, ctx)) return
      }
    }

    if (this.exiting) return

    // Spontaneous pick — one idle enemy starts charging.
    this.pickTimer -= dt
    if (this.pickTimer > 0) return
    if (this.chargingCount(ctx) >= cfg.maxCharging) {
      this.pickTimer = 0.2
      return
    }

    const pool = ctx.enemies.filter(
      (e) => e.alive && e.armed && !e.charging,
    )
    if (pool.length === 0) {
      this.pickTimer = randomRange(cfg.pickIntervalMin, cfg.pickIntervalMax)
      return
    }

    const pick = pool[Math.floor(Math.random() * pool.length)]!
    this.cascadeLeft = cfg.maxChainExplosions
    this.startCharge(pick, ctx)
    this.pickTimer = randomRange(cfg.pickIntervalMin, cfg.pickIntervalMax)
  }

  private chargingEnemies(ctx: EventContext): Enemy[] {
    return ctx.enemies.filter((e) => e.alive && e.charging)
  }

  private chargingCount(ctx: EventContext): number {
    return this.chargingEnemies(ctx).length
  }

  private startCharge(enemy: Enemy, ctx: EventContext): boolean {
    if (!enemy.alive || enemy.charging) return false
    if (this.chargingCount(ctx) >= EVENTS.chainExplosion.maxCharging) {
      return false
    }
    enemy.beginCharge()
    ctx.audio.playChargeWarn()
    return true
  }

  /** @returns true if a lethal hit was queued. */
  private explode(enemy: Enemy, ctx: EventContext): boolean {
    const cfg = EVENTS.chainExplosion
    const x = enemy.x
    const y = enemy.y

    enemy.alive = false
    enemy.clearCharge()
    enemy.setBerserk(false)
    this.cascadeLeft = Math.max(0, this.cascadeLeft - 1)

    ctx.addScore(cfg.scorePerBlast)
    ctx.audio.playExplosion()

    // Cinematic blast FX
    ctx.particles.flash = Math.max(ctx.particles.flash, 0.85)
    ctx.particles.shake = Math.max(ctx.particles.shake, 0.7)
    ctx.particles.shakeMag = Math.max(ctx.particles.shakeMag, 12)
    ctx.particles.emitCollect(x, y, 6, '#ff8a8a')
    ctx.particles.emitCollect(x, y, 4, '#ffffff')
    ctx.particles.shockwaves.push({
      x,
      y,
      age: 0,
      duration: 0.42,
      maxRadius: cfg.blastRadius * 1.15,
      alive: true,
      kind: 'death',
    })
    ctx.particles.shockwaves.push({
      x,
      y,
      age: -0.04,
      duration: 0.55,
      maxRadius: cfg.blastRadius * 0.65,
      alive: true,
      kind: 'combo',
    })

    if (
      distance(x, y, ctx.player.x, ctx.player.y) <
      cfg.blastRadius + ctx.player.radius * 0.65
    ) {
      ctx.killPlayer()
      return true
    }

    // Chain: nearby enemies begin charging (readable delay, not instant).
    if (this.cascadeLeft <= 0) return false
    if (this.chargingCount(ctx) >= cfg.maxCharging) return false

    const candidates = ctx.enemies.filter((e) => {
      if (!e.alive || e.charging) return false
      return distance(x, y, e.x, e.y) <= cfg.blastRadius
    })

    // Shuffle lightly so chains feel organic.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = candidates[i]!
      candidates[i] = candidates[j]!
      candidates[j] = tmp
    }

    for (const other of candidates) {
      if (this.cascadeLeft <= 0) break
      if (this.chargingCount(ctx) >= cfg.maxCharging) break
      if (Math.random() > cfg.chainChance) continue
      this.startCharge(other, ctx)
    }

    return false
  }

  protected exit(ctx: EventContext): void {
    for (const e of ctx.enemies) e.clearCharge()
    this.vignette = 0

    if (ctx.dying) return

    const want = Math.min(
      ENEMY.maxCount,
      Math.max(
        ctx.enemies.filter((e) => e.alive).length,
        ENEMY.initialCount,
      ),
    )
    ctx.setTargetEnemyCount(want)
    let alive = ctx.enemies.filter((e) => e.alive).length
    let guard = 0
    while (alive < want && guard++ < want) {
      const pos = ctx.findSpawn(0)
      if (!pos) break
      if (!ctx.spawnEnemyAt(pos.x, pos.y)) break
      alive++
    }
  }
}
