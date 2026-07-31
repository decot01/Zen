import { COLORS, ENEMY, EVENTS, PLAYER } from './constants'
import type { Enemy } from './Enemy'
import type { EventVisuals } from './events/EventContext'
import type { Orb } from './Orb'
import type { ParticleSystem } from './Particles'
import type { Player } from './Player'
import { clamp } from '@/utils/math'

export class Renderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1
  private ambientCanvas: HTMLCanvasElement | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    })
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.width = cssWidth
    this.height = cssHeight
    this.dpr = dpr
    this.canvas.width = Math.max(1, Math.floor(cssWidth * dpr))
    this.canvas.height = Math.max(1, Math.floor(cssHeight * dpr))
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${cssHeight}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.rebuildAmbient()
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  render(
    player: Player,
    orbs: readonly Orb[],
    enemies: readonly Enemy[],
    particles: ParticleSystem,
    options: {
      showPlayer: boolean
      dimmed?: boolean
      worldAlpha?: number
      events?: EventVisuals | null
    } = { showPlayer: true },
  ): void {
    const ctx = this.ctx
    const shake = particles.getShakeOffset()
    const worldAlpha = clamp(options.worldAlpha ?? 1, 0, 1)
    const events = options.events ?? null

    ctx.save()
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.translate(shake.x, shake.y)

    this.drawAmbient()

    if (events?.sniper) {
      this.drawSniperLasers(events.sniper)
    }

    for (const orb of orbs) {
      if (orb.alive) this.drawWhiteOrb(orb)
    }

    for (const enemy of enemies) {
      if (enemy.alive) this.drawEnemy(enemy)
    }

    if (events?.sniper) {
      this.drawSniperDrones(events.sniper)
    }

    // Soft blackout of the playfield (orbs/enemies) while death FX keep playing.
    if (worldAlpha < 0.999) {
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - worldAlpha})`
      ctx.fillRect(-shake.x, -shake.y, this.width, this.height)
    }

    this.drawParticles(particles)

    if (options.showPlayer) {
      this.drawPlayerTrail(player)
      this.drawPlayer(player)
    }

    this.drawShockwaves(particles)
    this.drawPopups(particles)

    if (particles.flash > 0) {
      ctx.fillStyle = `rgba(250, 250, 250, ${0.22 * particles.flash})`
      ctx.fillRect(-shake.x, -shake.y, this.width, this.height)
    }

    if (options.dimmed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(-shake.x, -shake.y, this.width, this.height)
    }

    ctx.restore()

    if (events?.chainExplosion && events.chainExplosion.vignette > 0.01) {
      this.drawChainExplosionVignette(events.chainExplosion.vignette)
    }
  }

  private drawChainExplosionVignette(strength: number): void {
    const ctx = this.ctx
    const g = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.5,
      Math.min(this.width, this.height) * 0.28,
      this.width * 0.5,
      this.height * 0.5,
      Math.hypot(this.width, this.height) * 0.62,
    )
    g.addColorStop(0, 'rgba(0, 0, 0, 0)')
    g.addColorStop(0.55, `rgba(40, 0, 0, ${0.08 * strength})`)
    g.addColorStop(1, `rgba(0, 0, 0, ${0.55 * strength})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.width, this.height)
  }

  private drawSniperLasers(
    sn: NonNullable<EventVisuals['sniper']>,
    glowMul = 1,
  ): void {
    const ctx = this.ctx
    const a = Math.min(1, sn.intensity)
    if (a < 0.02) return

    for (const laser of sn.lasers) {
      const { x1, y1, x2, y2 } = laser.line
      const pulse = laser.warningPulse
      const locked = laser.phase === 'locked'
      const firing = laser.phase === 'firing'
      const core = firing
        ? 0.95
        : locked
          ? 0.55 + pulse * 0.35
          : 0.25 + pulse * 0.35

      ctx.save()
      ctx.globalAlpha = a * (0.55 + core * 0.45)
      ctx.lineCap = 'round'

      // Soft beam via wide translucent stroke (no shadowBlur — huge at 120 Hz).
      ctx.strokeStyle = firing
        ? `rgba(255, 120, 120, ${0.22 + laser.fireFlash * 0.35})`
        : `rgba(255, 60, 60, ${0.12 + pulse * 0.18})`
      ctx.lineWidth = (firing ? 14 : locked ? 9 : 6) * glowMul
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      ctx.strokeStyle = firing
        ? '#ffffff'
        : locked
          ? `rgba(255, 180, 180, ${0.7 + pulse * 0.3})`
          : `rgba(255, 120, 120, ${0.4 + pulse * 0.4})`
      ctx.lineWidth = firing ? 2.5 + laser.fireFlash * 2 : locked ? 1.75 : 1.15
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      ctx.restore()
    }
  }

  private drawSniperDrones(sn: NonNullable<EventVisuals['sniper']>): void {
    const ctx = this.ctx
    const a = Math.min(1, sn.intensity)
    const size = EVENTS.sniper.droneSize

    for (const d of sn.drones) {
      if (d.appear < 0.02) continue
      ctx.save()
      ctx.translate(d.x, d.y)
      ctx.globalAlpha = a * d.appear

      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.2)
      halo.addColorStop(0, 'rgba(255, 40, 40, 0.45)')
      halo.addColorStop(1, 'rgba(255, 40, 40, 0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(0, 0, size * 2.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#1a1a1a'
      ctx.strokeStyle = '#ff5555'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.lineTo(size * 0.85, 0)
      ctx.lineTo(0, size)
      ctx.lineTo(-size * 0.85, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#ff3333'
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    }
  }

  private rebuildAmbient(): void {
    if (this.width < 1 || this.height < 1) {
      this.ambientCanvas = null
      return
    }
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.floor(this.width * this.dpr))
    c.height = Math.max(1, Math.floor(this.height * this.dpr))
    const gctx = c.getContext('2d')
    if (!gctx) {
      this.ambientCanvas = null
      return
    }
    gctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    const g = gctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.4,
      0,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.65,
    )
    g.addColorStop(0, 'rgba(250, 250, 250, 0.03)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    gctx.fillStyle = g
    gctx.fillRect(0, 0, this.width, this.height)
    this.ambientCanvas = c
  }

  private drawAmbient(): void {
    if (this.ambientCanvas) {
      this.ctx.drawImage(this.ambientCanvas, 0, 0, this.width, this.height)
      return
    }
    const ctx = this.ctx
    const g = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.4,
      0,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.65,
    )
    g.addColorStop(0, 'rgba(250, 250, 250, 0.03)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.width, this.height)
  }

  private drawPlayerTrail(player: Player): void {
    const ctx = this.ctx
    const trail = player.getTrail()
    const n = trail.length
    if (n === 0) return
    ctx.fillStyle = 'rgba(250, 250, 250, 1)'
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n
      const p = trail[i]!
      ctx.globalAlpha = 0.14 * t
      ctx.beginPath()
      ctx.arc(p.x, p.y, player.radius * 0.35 * t, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawPlayer(player: Player): void {
    const ctx = this.ctx
    const pulse = player.pulse
    const stretch = player.stretch
    const r = player.radius * pulse

    ctx.save()
    ctx.translate(player.x, player.y)
    ctx.rotate(player.heading)
    ctx.scale(1 + stretch, 1 - stretch * 0.55)

    const palette = [
      [0xbc, 0x82, 0xf3],
      [0xf5, 0xb9, 0xea],
      [0x8d, 0x9f, 0xff],
      [0xff, 0x67, 0x78],
      [0xff, 0xba, 0x71],
      [0xc6, 0x86, 0xff],
    ] as const
    const comboT = clamp(player.comboGlow / 9, 0, 1)
    const shimmerSpeed = 0.07 + comboT * 0.12
    const t = player.time * shimmerSpeed
    const i = Math.floor(t) % palette.length
    const j = (i + 1) % palette.length
    const f = t - Math.floor(t)
    const a = palette[i]!
    const b = palette[j]!
    const rr = Math.round(a[0] + (b[0] - a[0]) * f)
    const gg = Math.round(a[1] + (b[1] - a[1]) * f)
    const bb = Math.round(a[2] + (b[2] - a[2]) * f)
    const glowR = r + PLAYER.glowBlur * (0.55 + comboT * 0.2)

    const halo = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, glowR)
    halo.addColorStop(0, `rgba(${rr}, ${gg}, ${bb}, ${0.55 + comboT * 0.25})`)
    halo.addColorStop(0.55, `rgba(${rr}, ${gg}, ${bb}, ${0.18 + comboT * 0.12})`)
    halo.addColorStop(1, `rgba(${rr}, ${gg}, ${bb}, 0)`)
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(0, 0, glowR, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.white
    ctx.fill()

    ctx.restore()
  }

  private drawWhiteOrb(orb: Orb): void {
    const ctx = this.ctx
    const scale = orb.scale
    const r = Math.max(0.5, orb.radius * scale)
    const alpha = orb.alpha
    const prize = orb.kind === 'prize'

    ctx.save()
    ctx.translate(orb.x, orb.y)

    const ring = orb.appearRing
    if (ring) {
      ctx.beginPath()
      ctx.arc(0, 0, ring.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(250, 250, 250, ${ring.alpha})`
      ctx.lineWidth = 1.5 * (1 - orb.spawnProgress * 0.5)
      ctx.stroke()
    }

    if (prize) {
      const palette = [
        [0xbc, 0x82, 0xf3],
        [0xf5, 0xb9, 0xea],
        [0x8d, 0x9f, 0xff],
        [0xff, 0x67, 0x78],
        [0xff, 0xba, 0x71],
        [0xc6, 0x86, 0xff],
      ] as const
      const t = orb.time * 0.35
      const i = Math.floor(t) % palette.length
      const j = (i + 1) % palette.length
      const f = t - Math.floor(t)
      const ca = palette[i]!
      const cb = palette[j]!
      const rr = Math.round(ca[0] + (cb[0] - ca[0]) * f)
      const gg = Math.round(ca[1] + (cb[1] - ca[1]) * f)
      const bb = Math.round(ca[2] + (cb[2] - ca[2]) * f)
      const dprScale = this.dpr > 1.25 ? 0.85 : 1
      const lifeBoost = 0.75 + orb.lifeRatio * 0.45

      // Soft bloom via radial fill (no shadowBlur — expensive at 120 Hz).
      const bloom = ctx.createRadialGradient(
        0,
        0,
        r * 0.2,
        0,
        0,
        r * 2.4 * lifeBoost,
      )
      bloom.addColorStop(0, `rgba(255, 255, 255, ${0.95 * alpha})`)
      bloom.addColorStop(0.35, `rgba(${rr}, ${gg}, ${bb}, ${0.55 * alpha})`)
      bloom.addColorStop(1, `rgba(${rr}, ${gg}, ${bb}, 0)`)
      ctx.globalAlpha = 1
      ctx.fillStyle = bloom
      ctx.beginPath()
      ctx.arc(0, 0, r * 2.4 * lifeBoost * dprScale, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
    } else {
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
    }

    ctx.restore()
  }

  private drawEnemy(enemy: Enemy): void {
    const ctx = this.ctx
    const charging = enemy.charging
    const cp = enemy.chargeProgress
    const scale = enemy.scale * enemy.pulse
    const r = enemy.radius * scale
    const alpha = enemy.alpha
    const glowMul = enemy.berserk
      ? EVENTS.berserk.glowMul
      : charging
        ? 1.4 + cp * 2.2
        : 1
    const flash =
      charging && Math.sin(enemy.age * (14 + cp * 22)) > 0.15 ? 1 : 0

    ctx.save()
    ctx.translate(enemy.x, enemy.y)
    ctx.globalAlpha = alpha

    const glowR = r + ENEMY.glowBlur * 0.55 * glowMul
    const glowColor = charging
      ? flash
        ? '255, 170, 170'
        : '255, 50, 50'
      : enemy.berserk
        ? '255, 68, 68'
        : enemy.armed
          ? '250, 250, 250'
          : '115, 115, 115'
    const glowA = enemy.armed || charging || enemy.berserk ? 0.45 : 0.22
    const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, glowR)
    halo.addColorStop(0, `rgba(${glowColor}, ${glowA})`)
    halo.addColorStop(1, `rgba(${glowColor}, 0)`)
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(0, 0, glowR, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = charging
      ? flash
        ? '#7a2020'
        : '#4a1010'
      : enemy.berserk
        ? '#5c1515'
        : enemy.armed
          ? COLORS.dangerDark
          : 'rgba(63, 63, 70, 0.55)'
    ctx.fill()

    ctx.lineWidth = enemy.armed || enemy.berserk || charging ? 2.2 : 1.5
    ctx.strokeStyle = charging
      ? flash
        ? '#ffffff'
        : '#ff6b6b'
      : enemy.berserk
        ? '#ff6b6b'
        : enemy.armed
          ? COLORS.white
          : COLORS.danger
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2)
    ctx.fillStyle =
      enemy.armed || enemy.berserk || charging
        ? COLORS.white
        : 'rgba(250, 250, 250, 0.35)'
    ctx.fill()

    if (!enemy.armed && !charging) {
      ctx.globalAlpha = 0.3 + enemy.armProgress * 0.45
      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 1.25
      ctx.beginPath()
      ctx.arc(0, 0, r * (1.45 + (1 - enemy.armProgress) * 0.55), 0, Math.PI * 2)
      ctx.stroke()
    }

    if (charging) {
      const blastR = EVENTS.chainExplosion.blastRadius
      const blinkHz = 2.5 + cp * 8
      const blink = 0.5 + 0.5 * Math.sin(enemy.age * Math.PI * 2 * blinkHz)
      const ringA = (0.18 + cp * 0.55) * (0.4 + blink * 0.6)

      ctx.globalAlpha = alpha * ringA
      ctx.strokeStyle = flash ? '#ffffff' : '#ff8a8a'
      ctx.lineWidth = 1.5 + cp * 2
      ctx.beginPath()
      ctx.arc(0, 0, blastR, 0, Math.PI * 2)
      ctx.stroke()

      ctx.globalAlpha = alpha * (0.04 + cp * 0.14) * blink
      ctx.fillStyle = '#ff4444'
      ctx.beginPath()
      ctx.arc(0, 0, blastR, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  private drawParticles(system: ParticleSystem): void {
    const ctx = this.ctx
    const particles = system.getParticles()
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!
      const t = clamp(p.life / p.maxLife, 0, 1)
      ctx.globalAlpha = t
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawShockwaves(system: ParticleSystem): void {
    const ctx = this.ctx
    for (const s of system.shockwaves) {
      if (s.age < 0) continue
      const t = clamp(s.age / s.duration, 0, 1)
      const radius = s.maxRadius * t
      if (s.kind === 'combo') {
        ctx.beginPath()
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(250, 250, 250, ${(1 - t) * 0.28})`
        ctx.lineWidth = 1.4 * (1 - t * 0.45)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(250, 250, 250, ${1 - t})`
        ctx.lineWidth = 2.5 * (1 - t)
        ctx.stroke()
      }
    }
  }

  private drawPopups(system: ParticleSystem): void {
    const ctx = this.ctx
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const pop of system.popups) {
      const t = clamp(pop.age / pop.life, 0, 1)
      const y = pop.y - t * 48
      const scale = 1 + (pop.combo - 1) * 0.12
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
      ctx.save()
      ctx.translate(pop.x, y)
      ctx.scale(scale, scale)
      ctx.globalAlpha = clamp(alpha, 0, 1)
      const size = pop.label
        ? 18 + (pop.combo - 1) * 2
        : 14 + (pop.combo - 1) * 2
      ctx.font = `600 ${size}px "Space Grotesk", "DM Sans", system-ui, sans-serif`
      ctx.fillStyle = COLORS.text
      ctx.fillText(pop.label ?? `+${pop.value}`, 0, 0)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
}
